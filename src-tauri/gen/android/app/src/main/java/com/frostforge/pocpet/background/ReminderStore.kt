package com.frostforge.pocpet.background

import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.frostforge.pocpet.MainActivity
import com.frostforge.pocpet.R
import org.json.JSONArray
import org.json.JSONObject

class ReminderStore(private val context: Context) {
    private val prefs = context.getSharedPreferences("pocpet-reminders", Context.MODE_PRIVATE)
    private val alarms = context.getSystemService(AlarmManager::class.java)
    private fun load(name: String) = try { JSONObject(prefs.getString(name, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    private fun save(name: String, value: JSONObject) {
        val text = value.toString()
        if (prefs.getString(name, "") != text) check(prefs.edit().putString(name, text).commit()) { "提醒记录保存失败" }
    }
    private fun entries(obj: JSONObject) = obj.keys().asSequence().toList()
    private fun intent(key: String): PendingIntent = PendingIntent.getBroadcast(context, 0,
        Intent(context, ReminderReceiver::class.java).setAction("com.frostforge.pocpet.REMINDER")
            .setData(Uri.parse("pocpet-reminder:" + Uri.encode(key))).putExtra("key", key),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    private fun schedule(key: String, at: Long) {
        val pending = intent(key)
        try {
            if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
        } catch (_: SecurityException) { alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending) }
    }
    fun state(): JSONObject = synchronized(lock) {
        val plans = load("plans")
        JSONObject().put("owner", prefs.getString("owner", "")).put("plans", JSONArray(entries(plans).map { plans.getJSONObject(it) }))
    }
    fun sync(payload: JSONObject): JSONObject = synchronized(lock) {
        val owner = payload.optString("owner").take(128)
        var old = load("plans")
        if (owner != prefs.getString("owner", "")) {
            for (key in entries(old)) alarms.cancel(intent(key))
            old = JSONObject(); save("delivered", JSONObject()); save("foreground", JSONObject()); save("pending", JSONObject())
            check(prefs.edit().putString("owner", owner).commit())
        }
        val delivered = load("delivered"); val desired = JSONObject()
        val items = payload.optJSONArray("plans") ?: JSONArray()
        val now = System.currentTimeMillis()
        if (payload.optBoolean("enabled")) for (index in 0 until minOf(items.length(), 96)) {
            val plan = items.optJSONObject(index) ?: continue
            val key = plan.optString("key")
            val at = plan.optLong("at")
            if (key.isEmpty() || key.length > 512 || at <= 0 || !targets.contains(plan.optString("target")) || delivered.has(key)) continue
            if (at <= now && !old.has(key)) continue // Enabling notifications never replays old work.
            plan.put("owner", owner); desired.put(key, plan)
        }
        for (key in entries(old)) if (!desired.has(key)) alarms.cancel(intent(key))
        // Keep retries durable if scheduling fails after the desired plans were saved.
        val pending = load("pending")
        for (key in entries(pending)) if (!desired.has(key)) pending.remove(key)
        for (key in entries(desired)) {
            val plan = desired.getJSONObject(key)
            if (plan.optLong("at") > now && old.optJSONObject(key)?.toString() != plan.toString()) pending.put(key, true)
        }
        save("pending", pending)
        save("plans", desired)
        for (key in entries(desired)) {
            val plan = desired.getJSONObject(key)
            if (plan.getLong("at") <= now) fire(key)
            else if (pending.has(key)) {
                schedule(key, plan.getLong("at")); pending.remove(key); save("pending", pending)
            }
        }
        val foreground = load("foreground")
        val result = JSONObject().put("foreground", JSONArray(entries(foreground).map { foreground.getJSONObject(it) }))
        save("foreground", JSONObject())
        val target = prefs.getString("target", "") ?: ""
        if (target.isNotEmpty()) {
            result.put("target", target).put("owner", prefs.getString("targetOwner", ""))
            prefs.edit().remove("target").remove("targetOwner").commit()
        }
        result
    }
    fun rememberTarget(target: String, owner: String) { if (targets.contains(target)) prefs.edit().putString("target", target).putString("targetOwner", owner).commit() }
    fun fire(key: String) = synchronized(lock) {
        val plans = load("plans"); val first = plans.optJSONObject(key) ?: return@synchronized
        if (first.optLong("at") > System.currentTimeMillis()) { schedule(key, first.getLong("at")); return@synchronized }
        val delivered = load("delivered"); val foreground = load("foreground")
        val due = entries(plans).filter { val p = plans.getJSONObject(it); p.optLong("at") <= System.currentTimeMillis() && p.optString("target") == first.optString("target") }
        val visible = AppPresence.foreground && !context.getSystemService(KeyguardManager::class.java).isKeyguardLocked
        val fresh = due.filter { !delivered.has(it) }
        for (id in due) { alarms.cancel(intent(id)); plans.remove(id); delivered.put(id, System.currentTimeMillis()) }
        while (delivered.length() > 256) delivered.remove(entries(delivered).minByOrNull { delivered.optLong(it) } ?: break)
        save("delivered", delivered); save("plans", plans)
        if (fresh.isNotEmpty()) {
            if (fresh.size > 1) first.put("body", "有 ${fresh.size} 项计时或收获已到，回来看看吧。")
            if (visible) { foreground.put(key, first); save("foreground", foreground) }
            else show(first, false)
        }
    }
    fun restore(fireOverdue: Boolean = true) = synchronized(lock) {
        val plans = load("plans")
        val pending = JSONObject()
        for (key in entries(plans)) pending.put(key, true)
        save("pending", pending)
        for (key in entries(plans)) {
            val at = plans.getJSONObject(key).optLong("at")
            if (at <= System.currentTimeMillis()) { if (fireOverdue) fire(key) } else schedule(key, at)
        }
        save("pending", JSONObject())
    }
    fun show(plan: JSONObject, test: Boolean) {
        val manager = NotificationManagerCompat.from(context)
        check(manager.areNotificationsEnabled()) { "系统通知未获授权" }
        val category = plan.optString("category", "tasks")
        val channelId = "pocpet-$category"
        if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(channelId, when (category) { "harvest" -> "收获提醒"; "pomodoro" -> "番茄钟"; else -> "任务和挂机" }, NotificationManager.IMPORTANCE_DEFAULT))
        val target = plan.optString("target", "partnerSchedule")
        val content = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java)
            .setData(Uri.parse("pocpet-notification:" + Uri.encode(plan.optString("key"))))
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("pocpet-target", target).putExtra("pocpet-owner", plan.optString("owner")), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, channelId).setSmallIcon(R.drawable.ic_pocpet_notification)
            .setContentTitle(plan.optString("title", "PocPet").take(120)).setContentText(plan.optString("body").take(500))
            .setStyle(NotificationCompat.BigTextStyle().bigText(plan.optString("body").take(500)))
            .setContentIntent(content).setAutoCancel(true).setOnlyAlertOnce(false).build()
        manager.notify(if (test) "test" else target, 4201, notification)
    }
    companion object {
        private val lock = Any()
        val targets = setOf("partnerSchedule", "adventure", "fishing", "field", "garden", "ranch", "pomodoro", "music")
    }
}
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val store = ReminderStore(context)
            if (intent.action == "com.frostforge.pocpet.REMINDER") store.fire(intent.getStringExtra("key") ?: return)
            else store.restore()
        } catch (error: Exception) { android.util.Log.w("PocPet", "Reminder unavailable", error) }
    }
}
