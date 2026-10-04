package com.frostforge.pocpet.background

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.frostforge.pocpet.MainActivity
import com.frostforge.pocpet.R
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject
import java.util.UUID

private class ListeningRecord(context: Context) {
    private val prefs = context.getSharedPreferences("pocpet-listening", Context.MODE_PRIVATE)
    var owner = prefs.getString("owner", "") ?: ""
    var sessionId = prefs.getString("sessionId", "") ?: ""
    var milliseconds = prefs.getLong("milliseconds", 0)
    var acknowledged = prefs.getLong("acknowledged", 0)
    var volume = prefs.getFloat("volume", .6f)
    var allowBackground = prefs.getBoolean("allowBackground", false)
    var repeatMode = prefs.getString("repeatMode", "sequence") ?: "sequence"
    // Playback intent is deliberately not restored after process death or reboot.
    var active = false
    var requested = false
    var enabled = true
    var rewardEnabled = false
    var error = ""
    fun save() {
        check(prefs.edit().putString("owner", owner).putString("sessionId", sessionId)
            .putLong("milliseconds", milliseconds).putLong("acknowledged", acknowledged)
            .putFloat("volume", volume).putBoolean("allowBackground", allowBackground)
            .putString("repeatMode", repeatMode).commit()) { "聆听记录保存失败" }
    }
    fun reset(nextOwner: String) {
        owner = nextOwner; sessionId = ""; milliseconds = 0; acknowledged = 0
        active = false; requested = false; error = ""; save()
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class MusicService : MediaSessionService() {
    private lateinit var player: ExoPlayer
    private var session: MediaSession? = null
    private val handler = Handler(Looper.getMainLooper())
    private var internalChange = false
    private var clock = 0L
    private var position = 0L
    private var eligible = false
    private var lastSave = 0L
    private val state get() = record(this)
    private val pulse = object : Runnable {
        override fun run() {
            try {
                sample()
                if (SystemClock.elapsedRealtime() - lastSave >= 5000) { state.save(); lastSave = SystemClock.elapsedRealtime() }
            } catch (_: Exception) { state.error = "聆听记录保存失败，播放已暂停。"; state.requested = false; applyPlayback() }
            handler.postDelayed(this, 1000)
        }
    }
    override fun onCreate() {
        super.onCreate()
        instance = this
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            setHandleAudioBecomingNoisy(true)
            setWakeMode(C.WAKE_MODE_LOCAL)
        }
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { sample() }
            override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
                sample(oldPosition.positionMs); resetMeter()
            }
            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                sample()
                if (!internalChange && (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST || reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY)) {
                    state.requested = playWhenReady
                    if (playWhenReady && !state.allowBackground && !AppPresence.foreground) applyPlayback()
                }
                resetMeter()
            }
            override fun onPlayerError(error: PlaybackException) {
                sample(); state.error = "这首音乐暂时无法播放，请重试。"; state.requested = false; persistSafely()
            }
        })
        val stop = SessionCommand("pocpet.stop", Bundle.EMPTY)
        val controls = object : ForwardingPlayer(player) {
            override fun getAvailableCommands(): Player.Commands = super.getAvailableCommands().buildUpon().apply {
                // Manual next wraps the playlist, including its last song in repeat-one mode.
                if (player.mediaItemCount > 0) add(Player.COMMAND_SEEK_TO_NEXT).add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            }.build()
            override fun isCommandAvailable(command: Int): Boolean = availableCommands.contains(command)
            override fun seekToNext() { seekToNextMediaItem() }
            override fun seekToNextMediaItem() {
                if (player.mediaItemCount > 0) { sample(); player.seekToDefaultPosition((player.currentMediaItemIndex + 1) % player.mediaItemCount); resetMeter() }
            }
        }
        session = MediaSession.Builder(this, controls).setSessionActivity(PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java).putExtra("pocpet-target", "music").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .setCallback(object : MediaSession.Callback {
                override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
                    if (!controller.isTrusted && controller.packageName != packageName) return MediaSession.ConnectionResult.reject()
                    return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                        .setAvailableSessionCommands(MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().add(stop).build()).build()
                }
                override fun onCustomCommand(session: MediaSession, controller: MediaSession.ControllerInfo, customCommand: SessionCommand, args: Bundle): ListenableFuture<SessionResult> {
                    if (customCommand.customAction == stop.customAction) finishPlayback()
                    return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
                }
            }).build().also {
                it.setCustomLayout(ImmutableList.of(CommandButton.Builder().setDisplayName("停止")
                    .setIconResId(android.R.drawable.ic_menu_close_clear_cancel).setSessionCommand(stop).build()))
            }
        setMediaNotificationProvider(DefaultMediaNotificationProvider.Builder(this).build().apply { setSmallIcon(R.drawable.ic_pocpet_notification) })
        resetMeter(); handler.post(pulse)
    }
    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val result = super.onStartCommand(intent, flags, startId)
        val pending = pendingStart; pendingStart = null
        if (pending != null) {
            try { execute(pending.payload); pending.resolve(snapshot(this)) }
            catch (error: Exception) { pending.reject(error.message ?: "音乐播放失败"); finishPlayback() }
        }
        return result
    }
    private fun resetMeter() {
        position = player.currentPosition; clock = SystemClock.elapsedRealtime()
        eligible = state.active && state.rewardEnabled && state.enabled && state.volume > 0 && player.isPlaying
    }
    private fun sample(endPosition: Long = player.currentPosition) {
        val elapsed = (SystemClock.elapsedRealtime() - clock).coerceAtLeast(0)
        val progress = (endPosition - position).coerceAtLeast(0)
        if (eligible) state.milliseconds = (state.milliseconds + minOf(progress, elapsed)).coerceAtMost(9007199254740991L)
        resetMeter()
    }
    private fun persistSafely() { try { state.save() } catch (_: Exception) { state.error = "聆听记录保存失败。"; state.requested = false; applyPlayback() } }
    private fun applyPlayback() {
        sample(); internalChange = true
        try {
            player.volume = if (state.enabled) state.volume else 0f
            player.repeatMode = if (state.repeatMode == "single") Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_ALL
            if (state.active && state.requested && state.enabled && (AppPresence.foreground || state.allowBackground)) player.play() else player.pause()
        } finally { internalChange = false; resetMeter() }
    }
    fun visibilityChanged() { applyPlayback(); persistSafely() }
    private fun configure(payload: JSONObject) {
        sample()
        if (payload.has("volume")) state.volume = payload.optDouble("volume", .6).toFloat().coerceIn(0f, 1f)
        if (payload.has("enabled")) state.enabled = payload.optBoolean("enabled")
        if (payload.has("rewardEnabled")) state.rewardEnabled = payload.optBoolean("rewardEnabled")
        if (payload.has("allowBackground")) state.allowBackground = payload.optBoolean("allowBackground")
        if (payload.has("repeatMode")) state.repeatMode = if (payload.optString("repeatMode") == "single") "single" else "sequence"
    }
    private fun execute(payload: JSONObject) {
        when (payload.optString("op")) {
            "play" -> {
                configure(payload)
                if (!state.active || player.mediaItemCount == 0) {
                    if (state.sessionId.isEmpty() || state.acknowledged >= state.milliseconds) {
                        state.sessionId = UUID.randomUUID().toString(); state.milliseconds = 0; state.acknowledged = 0
                    }
                    val index = tracks.indexOfFirst { it.id == payload.optString("trackId") }.coerceAtLeast(0)
                    internalChange = true
                    try {
                        player.setMediaItems(tracks.map { track -> MediaItem.Builder().setMediaId(track.id)
                            .setUri("asset:///" + track.file).setMediaMetadata(MediaMetadata.Builder().setTitle(track.title).setArtist("PocPet").build()).build() }, index,
                            (payload.optDouble("position", 0.0).coerceIn(0.0, 86400.0) * 1000).toLong())
                    } finally { internalChange = false }
                }
                state.active = true; state.requested = true; state.error = ""
                player.prepare(); applyPlayback()
            }
            "pause" -> { sample(); state.requested = false; applyPlayback() }
            "stop", "discard" -> finishPlayback()
            "next" -> if (player.mediaItemCount > 0) { sample(); player.seekToDefaultPosition((player.currentMediaItemIndex + 1) % player.mediaItemCount); resetMeter() }
            "configure" -> { configure(payload); applyPlayback() }
            else -> sample()
        }
        state.save()
    }
    private fun finishPlayback() {
        sample(); state.active = false; state.requested = false
        internalChange = true
        try { player.stop(); player.clearMediaItems() } finally { internalChange = false }
        persistSafely(); stopSelf()
    }
    override fun onTaskRemoved(rootIntent: Intent?) {
        AppPresence.foreground = false
        if (!state.allowBackground || !isPlaybackOngoing()) finishPlayback()
    }
    override fun onDestroy() {
        sample(); handler.removeCallbacksAndMessages(null)
        state.active = false; state.requested = false; persistSafely()
        session?.release(); player.release(); session = null; instance = null
        super.onDestroy()
    }
    companion object {
        var instance: MusicService? = null
            private set
        private var saved: ListeningRecord? = null
        private fun record(context: Context): ListeningRecord = saved ?: ListeningRecord(context.applicationContext).also { saved = it }
        private data class Start(val payload: JSONObject, val resolve: (JSONObject) -> Unit, val reject: (String) -> Unit)
        private var pendingStart: Start? = null
        private data class Track(val id: String, val title: String, val file: String)
        private val tracks = listOf(
            Track("room", "小窝时光", "bgm_room_loop.mp3"), Track("gardenF1", "午后云朵", "bgm_garden_f1.mp3"),
            Track("gardenF2", "轻松爵士", "bgm_garden_f2.mp3"), Track("fishingF3", "溪边吉他 · 一", "bgm_fishing_f3.mp3"),
            Track("fishingF4", "溪边吉他 · 二", "bgm_fishing_f4.mp3"), Track("adventureA2", "轻快的旅途", "bgm_adventure_a2.mp3"),
            Track("adventureA5", "向着远方", "bgm_adventure_a5.mp3"), Track("nightA3", "夜色吉他 · 一", "bgm_night_a3.mp3"),
            Track("nightA4", "夜色吉他 · 二", "bgm_night_a4.mp3"), Track("shop", "小店闲逛", "bgm_shop_loop.mp3"), Track("sleep", "晚安好梦", "bgm_sleep_loop.mp3"))
        fun command(context: Context, payload: JSONObject, resolve: (JSONObject) -> Unit, reject: (String) -> Unit) {
            val state = record(context)
            val owner = payload.optString("owner").take(256)
            val op = payload.optString("op")
            if (op == "bind") {
                if (state.owner != owner) { instance?.finishPlayback(); state.reset(owner) }
                resolve(snapshot(context)); return
            }
            check(owner == state.owner) { "音乐会话已切换" }
            if (op == "acknowledge") {
                if (payload.optString("sessionId") == state.sessionId) state.acknowledged = maxOf(state.acknowledged, payload.optLong("milliseconds").coerceIn(0, state.milliseconds))
                state.save(); resolve(snapshot(context)); return
            }
            if (op == "play" && (instance == null || !state.active)) {
                pendingStart = Start(payload, resolve, reject)
                try { context.startService(Intent(context, MusicService::class.java)) }
                catch (error: Exception) { pendingStart = null; reject(error.message ?: "无法启动音乐服务") }
                return
            }
            instance?.execute(payload)
            if (op == "discard") state.reset(owner)
            if (instance == null && op == "configure") {
                state.enabled = payload.optBoolean("enabled", state.enabled); state.rewardEnabled = payload.optBoolean("rewardEnabled", state.rewardEnabled)
                state.volume = payload.optDouble("volume", state.volume.toDouble()).toFloat().coerceIn(0f, 1f)
                state.allowBackground = payload.optBoolean("allowBackground", state.allowBackground)
                state.repeatMode = payload.optString("repeatMode", state.repeatMode); state.save()
            }
            resolve(snapshot(context))
        }
        private fun snapshot(context: Context): JSONObject {
            val state = record(context); val service = instance
            service?.sample()
            return JSONObject().put("active", state.active).put("playing", service?.player?.isPlaying == true)
                .put("paused", !state.requested).put("hiddenPaused", state.requested && !state.allowBackground && !AppPresence.foreground)
                .put("trackId", service?.player?.currentMediaItem?.mediaId ?: "room").put("position", (service?.player?.currentPosition ?: 0) / 1000.0)
                .put("volume", state.volume).put("allowBackground", state.allowBackground).put("repeatMode", state.repeatMode).put("error", state.error)
                .apply { if (state.sessionId.isNotEmpty()) put("receipt", JSONObject().put("sessionId", state.sessionId).put("owner", state.owner).put("milliseconds", state.milliseconds)) }
        }
    }
}
