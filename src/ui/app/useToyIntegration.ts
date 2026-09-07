import { useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { features } from '../../platform/edition';
import { getStoredSaveIdentity } from '../../core/storage';
import {
  getCloudReminderDecision,
  markCloudReminderShownToday,
  readCloudReminderPreferences,
  shouldDisplayCloudReminder,
  snoozeCloudReminder,
  writeCloudReminderPreferences,
  type CloudReminderPreferencesV1,
} from '../../core/cloudReminder';
import {
  getCloudSaveStatus,
  hasAuthorFollowGiftCloudMarker,
  restoreCloudSave,
  uploadCloudSave,
  writeAuthorFollowGiftCloudMarker,
  type CloudSaveManifestV1,
  type RestoredCloudSave,
} from '../../core/cloudSave';
import {
  authorFollowGiftRewardId,
  authorFollowGiftTickets,
  claimAuthorFollowGift,
  type PetState,
} from '../../core/pet';
import type { ActivePetMod } from '../../core/mod';
import { t } from '../../i18n';
import {
  getToySdk,
  getSafeToyPageUrl,
  isToyPreviewUrl,
  openAuthorSpace,
  openIntroVideo,
  openToySharePanel,
  pocPetIntroVideoBvid,
  readAuthorFollowing,
  readAuthorSummary,
  readAuthorVideoSummary,
  supportsToyAbility,
  supportsToyCloudStorage,
  withToySdkTimeout,
  type ToyAuthorSummary,
  type ToyAuthorVideoSummary,
} from '../../platform/toySdk';

const authorFollowPendingKey = 'pocpet.author-follow-pending.v2';

export type ToyCloudAvailability = 'checking' | 'available' | 'unsupported' | 'unavailable';
export type ToyCloudBusyAction = 'upload' | 'restore' | null;

interface UseToyIntegrationOptions {
  pet: PetState;
  petRef: MutableRefObject<PetState>;
  activeMod: ActivePetMod | null;
  setPet: Dispatch<SetStateAction<PetState>>;
  commitPet: (next: PetState) => PetState;
  onMessage: (message: string) => void;
  onAuthorReward: (tickets: number) => void;
}

const readPendingAuthorFollow = () => {
  try {
    return window.localStorage.getItem(authorFollowPendingKey) === '1';
  } catch {
    return false;
  }
};

const writePendingAuthorFollow = (pending: boolean) => {
  try {
    if (pending) window.localStorage.setItem(authorFollowPendingKey, '1');
    else window.localStorage.removeItem(authorFollowPendingKey);
  } catch {
    // A disabled localStorage should not prevent navigation to public author content.
  }
};

export const useToyIntegration = ({
  pet,
  petRef,
  activeMod,
  setPet,
  commitPet,
  onMessage,
  onAuthorReward,
}: UseToyIntegrationOptions) => {
  const [cloudAvailability, setCloudAvailability] = useState<ToyCloudAvailability>(features.cloudSave ? 'checking' : 'unsupported');
  const [cloudManifest, setCloudManifest] = useState<CloudSaveManifestV1>();
  const [cloudUsedFallback, setCloudUsedFallback] = useState(false);
  const [cloudBusy, setCloudBusy] = useState<ToyCloudBusyAction>(null);
  const [preferences, setPreferencesState] = useState<CloudReminderPreferencesV1>(() => readCloudReminderPreferences());
  const [isReminderPromptVisible, setReminderPromptVisible] = useState(false);
  const [cloudGiftClaimed, setCloudGiftClaimed] = useState<boolean>();
  const [authorSummary, setAuthorSummary] = useState<ToyAuthorSummary>({});
  const [authorVideo, setAuthorVideo] = useState<ToyAuthorVideoSummary>({ bvid: pocPetIntroVideoBvid });
  const [isAuthorLoading, setAuthorLoading] = useState(false);
  const [shareDetails, setShareDetails] = useState<{ base64?: string; url: string }>();
  const reminderPromptedThisSessionRef = useRef(false);
  const authorVerificationRef = useRef(false);
  const authorVerificationAttemptedRef = useRef(false);
  const shareCapabilitiesRef = useRef({ ready: false, appShare: false, qrCode: false });
  const activeModRef = useRef(activeMod);
  const callbacksRef = useRef({ commitPet, onMessage, onAuthorReward });
  activeModRef.current = activeMod;
  callbacksRef.current = { commitPet, onMessage, onAuthorReward };

  const setPreferences = (next: CloudReminderPreferencesV1) => {
    setPreferencesState(next);
    writeCloudReminderPreferences(next);
  };

  useEffect(() => {
    let cancelled = false;
    const sdk = getToySdk();
    if (!features.cloudSave || !sdk) {
      setCloudAvailability('unsupported');
      return;
    }

    void supportsToyCloudStorage(sdk).then(async (supported) => {
      if (cancelled) return;
      if (!supported) {
        setCloudAvailability('unsupported');
        return;
      }
      try {
        const [status, giftClaimed] = await Promise.all([
          getCloudSaveStatus(sdk),
          hasAuthorFollowGiftCloudMarker(sdk),
        ]);
        if (cancelled) return;
        setCloudManifest(status.manifest);
        setCloudUsedFallback(status.usedFallbackManifest);
        setCloudGiftClaimed(giftClaimed);
        setCloudAvailability('available');
      } catch {
        if (!cancelled) setCloudAvailability('unavailable');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sdk = getToySdk();
    if (!sdk) {
      shareCapabilitiesRef.current = { ready: true, appShare: false, qrCode: false };
      return;
    }
    void Promise.all([
      supportsToyAbility('share', sdk),
      supportsToyAbility('getQrCode', sdk),
    ]).then(([appShare, qrCode]) => {
      if (!cancelled) shareCapabilitiesRef.current = { ready: true, appShare, qrCode };
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudGiftClaimed || pet.claimedRewardIds.includes(authorFollowGiftRewardId)) return;
    setPet((current) => {
      const result = claimAuthorFollowGift(current, false);
      return result.claimed ? callbacksRef.current.commitPet(result.pet) : current;
    });
  }, [cloudGiftClaimed, pet.claimedRewardIds, setPet]);

  const reminderDecision = useMemo(() => getCloudReminderDecision({
    createdAt: pet.createdAt,
    uploadedAt: cloudManifest ? Date.parse(cloudManifest.uploadedAt) : undefined,
    now: pet.lastUpdatedAt,
    preferences,
  }), [cloudManifest, pet.createdAt, pet.lastUpdatedAt, preferences]);
  const isCloudReminderDue = cloudAvailability === 'available' && reminderDecision.due;

  useEffect(() => {
    if (!shouldDisplayCloudReminder(cloudAvailability === 'available', reminderDecision) || reminderPromptedThisSessionRef.current) return;
    reminderPromptedThisSessionRef.current = true;
    setReminderPromptVisible(true);
    setPreferences(markCloudReminderShownToday(preferences));
  }, [isCloudReminderDue, preferences, reminderDecision.suppressedToday]);

  useEffect(() => {
    if (!preferences.enabled || !isCloudReminderDue) setReminderPromptVisible(false);
  }, [isCloudReminderDue, preferences.enabled]);

  const upload = async () => {
    const sdk = getToySdk();
    if (!features.cloudSave || !sdk || cloudAvailability !== 'available' || cloudBusy) throw new Error(t('ui.settings.cloud.unavailable'));
    setCloudBusy('upload');
    try {
      const manifest = await uploadCloudSave(sdk, petRef.current, getStoredSaveIdentity() ?? activeModRef.current?.manifest);
      setCloudManifest(manifest);
      setCloudUsedFallback(false);
      setReminderPromptVisible(false);
      onMessage(t('ui.settings.cloud.uploaded'));
      return manifest;
    } finally {
      setCloudBusy(null);
    }
  };

  const restore = async (): Promise<RestoredCloudSave> => {
    const sdk = getToySdk();
    if (!features.cloudSave || !sdk || cloudAvailability !== 'available' || cloudBusy) throw new Error(t('ui.settings.cloud.unavailable'));
    setCloudBusy('restore');
    try {
      const result = await restoreCloudSave(sdk);
      setCloudManifest(result.manifest);
      setCloudUsedFallback(result.recoveredFromPrevious);
      return result;
    } finally {
      setCloudBusy(null);
    }
  };

  const setReminderEnabled = (enabled: boolean) => {
    const next = {
      ...preferences,
      enabled,
      lastShownDateKey: enabled && !preferences.enabled ? undefined : preferences.lastShownDateKey,
    };
    if (enabled) reminderPromptedThisSessionRef.current = false;
    setPreferences(next);
  };

  const dismissReminder = () => setReminderPromptVisible(false);
  const snoozeReminder = () => {
    setPreferences(snoozeCloudReminder(preferences));
    setReminderPromptVisible(false);
  };

  const verifyPendingAuthorFollow = async () => {
    if (!readPendingAuthorFollow() || authorVerificationRef.current || authorVerificationAttemptedRef.current) return;
    const sdk = getToySdk();
    if (!sdk) return;
    authorVerificationRef.current = true;
    authorVerificationAttemptedRef.current = true;
    try {
      const [hasRelation, hasCloud] = await Promise.all([
        supportsToyAbility('getAuthorRelation', sdk),
        supportsToyCloudStorage(sdk),
      ]);
      if (!hasRelation || !hasCloud) return;
      const following = readAuthorFollowing(await sdk.getAuthorRelation());
      if (following === undefined) return;
      if (!following) {
        writePendingAuthorFollow(false);
        callbacksRef.current.onMessage(t('ui.settings.author.followNotFound'));
        return;
      }

      const alreadyClaimed = await hasAuthorFollowGiftCloudMarker(sdk);
      if (!alreadyClaimed) await writeAuthorFollowGiftCloudMarker(sdk);
      setCloudGiftClaimed(true);
      writePendingAuthorFollow(false);
      setPet((current) => {
        const result = claimAuthorFollowGift(current, !alreadyClaimed);
        if (result.claimed && !alreadyClaimed) {
          callbacksRef.current.onAuthorReward(authorFollowGiftTickets);
        }
        return result.claimed ? callbacksRef.current.commitPet(result.pet) : current;
      });
      callbacksRef.current.onMessage(t(alreadyClaimed
        ? 'ui.settings.author.claimSynced'
        : 'ui.settings.author.claimed', { count: authorFollowGiftTickets }));
    } catch (error) {
      callbacksRef.current.onMessage(error instanceof Error ? error.message : t('ui.settings.author.verifyFailed'));
    } finally {
      authorVerificationRef.current = false;
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void verifyPendingAuthorFollow();
    };
    void verifyPendingAuthorFollow();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  const handleOpenAuthorSpace = async () => {
    const isToy = Boolean(getToySdk());
    if (isToy) {
      authorVerificationAttemptedRef.current = false;
      writePendingAuthorFollow(true);
    }
    try {
      await openAuthorSpace();
    } catch (error) {
      if (isToy) writePendingAuthorFollow(false);
      onMessage(error instanceof Error ? error.message : t('ui.settings.author.openFailed'));
    }
  };

  const handleOpenIntroVideo = async () => {
    try {
      await openIntroVideo();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : t('ui.settings.author.videoFailed'));
    }
  };

  const loadAuthorContent = async () => {
    const sdk = getToySdk();
    if (!sdk || isAuthorLoading) return;
    setAuthorLoading(true);
    try {
      const [profileSupported, videosSupported] = await Promise.all([
        supportsToyAbility('getAuthorProfile', sdk),
        supportsToyAbility('getAuthorVideos', sdk),
      ]);
      const [profile, video] = await Promise.all([
        profileSupported ? sdk.getAuthorProfile() : undefined,
        videosSupported ? sdk.getAuthorVideos({ videos: [{ bvid: pocPetIntroVideoBvid }] }) : undefined,
      ]);
      if (profile) setAuthorSummary(readAuthorSummary(profile));
      if (video) setAuthorVideo(readAuthorVideoSummary(video, pocPetIntroVideoBvid));
    } catch {
      // Static public author/video information remains usable when enrichment fails.
    } finally {
      setAuthorLoading(false);
    }
  };

  const showShareLink = (url: string, messageKey: 'ui.share.previewFallback' | 'ui.share.linkReady') => {
    setShareDetails({ url });
    onMessage(t(messageKey));
  };

  const prepareQrOrLink = async (
    sdk: ReturnType<typeof getToySdk>,
    fallbackMessageKey: 'ui.share.previewFallback' | 'ui.share.linkReady',
  ) => {
    const pageUrl = getSafeToyPageUrl();
    if (sdk && shareCapabilitiesRef.current.qrCode) {
      try {
        const details = await withToySdkTimeout(
          sdk.getQrCode({ path: 'index.html', size: 320 }),
          8_000,
          t('ui.share.shareTimeout'),
        );
        setShareDetails(details);
        onMessage(t('ui.share.qrReady'));
        return;
      } catch {
        // Preview URLs can be rejected by the Toy path validator; expose the safe link below.
      }
    }
    if (pageUrl) {
      showShareLink(pageUrl, fallbackMessageKey);
      return;
    }
    onMessage(t('ui.share.appUnavailable'));
  };

  const shareWithWebApi = (url: string) => {
    if (typeof navigator.share !== 'function') return false;
    onMessage(t('ui.share.opening'));
    try {
      const operation = navigator.share({ title: 'PocPet', url });
      void withToySdkTimeout(operation, 10_000, t('ui.share.shareTimeout')).then(
        () => onMessage(t('ui.share.panelOpened')),
        () => showShareLink(url, 'ui.share.previewFallback'),
      );
      return true;
    } catch {
      return false;
    }
  };

  const shareApp = () => {
    const sdk = getToySdk();
    const pageUrl = getSafeToyPageUrl();
    if (pageUrl && isToyPreviewUrl(pageUrl)) {
      if (!shareWithWebApi(pageUrl)) void prepareQrOrLink(sdk, 'ui.share.previewFallback');
      return;
    }
    if (!sdk || !pageUrl) {
      onMessage(t('ui.share.appUnavailable'));
      return;
    }

    const capabilities = shareCapabilitiesRef.current;
    if (!capabilities.ready) {
      onMessage(t('ui.share.capabilityChecking'));
      return;
    }

    if (!capabilities.appShare) {
      if (!shareWithWebApi(pageUrl)) void prepareQrOrLink(sdk, 'ui.share.linkReady');
      return;
    }

    onMessage(t('ui.share.opening'));
    try {
      const operation = openToySharePanel(sdk);
      void withToySdkTimeout(operation, 10_000, t('ui.share.shareTimeout')).then(
        () => onMessage(t('ui.share.panelOpened')),
        () => void prepareQrOrLink(sdk, 'ui.share.linkReady'),
      );
    } catch (error) {
      void prepareQrOrLink(sdk, 'ui.share.linkReady');
    }
  };

  const copyShareLink = async () => {
    const url = shareDetails?.url;
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Copy failed.');
      }
      onMessage(t('ui.share.linkCopied'));
    } catch {
      onMessage(t('ui.share.copyFailed'));
    }
  };

  return {
    cloudAvailability,
    cloudManifest,
    cloudUsedFallback,
    cloudBusy,
    preferences,
    isCloudReminderDue,
    isReminderPromptVisible,
    upload,
    restore,
    setReminderEnabled,
    dismissReminder,
    snoozeReminder,
    authorSummary,
    authorVideo,
    isAuthorLoading,
    hasClaimedAuthorFollowGift: pet.claimedRewardIds.includes(authorFollowGiftRewardId),
    openAuthorSpace: handleOpenAuthorSpace,
    openIntroVideo: handleOpenIntroVideo,
    loadAuthorContent,
    shareDetails,
    shareApp,
    copyShareLink,
  };
};
