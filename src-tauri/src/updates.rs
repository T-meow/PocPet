use std::time::Duration;

const RELEASE_API: &str = "https://api.github.com/repos/T-meow/PocPet/releases/latest";
const DOWNLOAD_PREFIX: &str = "https://github.com/T-meow/PocPet/releases/download/";

fn allowed_source(url: &str) -> bool {
  if url == RELEASE_API { return true; }
  let Some(path) = url.strip_prefix(DOWNLOAD_PREFIX) else { return false; };
  let Some(tag) = path.strip_suffix("/update-info.json") else { return false; };
  let version = tag.strip_prefix('v').unwrap_or(tag);
  let parts: Vec<_> = version.split('.').collect();
  parts.len() == 3 && parts.iter().all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
}

#[tauri::command]
pub async fn read_client_update_json(url: String) -> Result<serde_json::Value, String> {
  if !allowed_source(&url) { return Err("invalid".into()); }
  // Native HTTPS avoids WebView CORS restrictions on GitHub release assets.
  let client = reqwest::Client::builder()
    .user_agent(concat!("PocPet/", env!("CARGO_PKG_VERSION")))
    .https_only(true)
    .timeout(Duration::from_secs(10))
    .redirect(reqwest::redirect::Policy::limited(5))
    .build().map_err(|_| "network")?;
  let mut response = client.get(&url).send().await.map_err(|_| "network")?;
  match response.status().as_u16() {
    404 if url == RELEASE_API => return Ok(serde_json::Value::Null),
    403 | 429 => return Err("rateLimit".into()),
    200 => {},
    _ => return Err("network".into()),
  }
  let mut bytes = Vec::new();
  while let Some(chunk) = response.chunk().await.map_err(|_| "network")? {
    if bytes.len() + chunk.len() > 2 * 1024 * 1024 { return Err("invalid".into()); }
    bytes.extend_from_slice(&chunk);
  }
  serde_json::from_slice(&bytes).map_err(|_| "invalid".into())
}

#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  #[ignore = "Requires network access to the public GitHub API"]
  fn reads_public_release() {
    let value = tauri::async_runtime::block_on(read_client_update_json(RELEASE_API.into())).unwrap();
    assert!(value.is_null() || value["draft"] == false && value["prerelease"] == false && value["assets"].is_array());
  }
  #[test]
  fn only_reads_official_update_metadata() {
    assert!(allowed_source(RELEASE_API));
    assert!(allowed_source(&format!("{DOWNLOAD_PREFIX}v1.6.1/update-info.json")));
    assert!(!allowed_source(&format!("{DOWNLOAD_PREFIX}../update-info.json")));
    assert!(!allowed_source(&format!("{DOWNLOAD_PREFIX}v1.6.1/pocket1.6.1.exe")));
    assert!(!allowed_source("https://example.com/update-info.json"));
  }
}
