package com.frostforge.pocpet

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Keep the whole WebView below visible system bars, including older WebViews
    // that do not expose Android's status bar through CSS safe-area-inset-top.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, windowInsets ->
      val types = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val safeArea = windowInsets.getInsets(types)
      view.setPadding(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom)

      // Forward updates with the handled areas zeroed to avoid double padding;
      // leave keyboard insets available to the WebView.
      WindowInsetsCompat.Builder(windowInsets)
        .setInsets(types, Insets.NONE)
        .build()
    }
    ViewCompat.requestApplyInsets(content)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.settings.setSupportZoom(false)
    webView.settings.builtInZoomControls = false
    webView.settings.displayZoomControls = false
    webView.settings.textZoom = 100
  }
}
