package uz.safekid.devicecontrol

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Keeps the process alive with a persistent notification and talks to the
 * server: heartbeat, polling for policy changes and permission watch.
 */
class EnforcementService : Service() {
  private var scheduler: ScheduledExecutorService? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    isRunning = true
    startInForeground()
    if (scheduler == null) startLoops()
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    scheduler?.shutdownNow()
    scheduler = null
    super.onDestroy()
  }

  private fun startLoops() {
    val sync = SyncEngine(this)
    scheduler = Executors.newSingleThreadScheduledExecutor().apply {
      // Until FCM is configured the device polls; with push this becomes a fallback.
      scheduleWithFixedDelay({ safely("heartbeat") { sync.heartbeat() } }, 0, SYNC_POLL_SECONDS, TimeUnit.SECONDS)
      scheduleWithFixedDelay({ safely("permissions") { watchPermissions(sync) } }, 5, 30, TimeUnit.SECONDS)
    }
  }

  /** Reports permissions that went from granted to denied (tamper). */
  private fun watchPermissions(sync: SyncEngine) {
    val store = DeviceSession.get(this).store
    val current = Permissions.status(this)
    val previous = store.lastPermissions()
    if (current == previous) return
    store.saveLastPermissions(current)
    DeviceEvents.emitPermissions(current)
    current.filter { (kind, state) -> previous[kind] == "granted" && state == "denied" }.keys.forEach { kind ->
      sync.reportAlert("PERMISSION_REVOKED", mapOf("permission" to kind))
    }
  }

  private inline fun safely(task: String, block: () -> Unit) {
    try {
      block()
    } catch (e: DeviceUnlinkedException) {
      stopSelf()
    } catch (e: Exception) {
      Log.w(TAG, "$task failed: ${e.message}")
    }
  }

  private fun startInForeground() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, getString(R.string.safekid_channel_name), NotificationManager.IMPORTANCE_LOW),
      )
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      android.app.PendingIntent.getActivity(this, 0, it, android.app.PendingIntent.FLAG_IMMUTABLE)
    }
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(getString(R.string.safekid_notification_title))
      .setContentText(getString(R.string.safekid_notification_text))
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setOngoing(true)
      .setContentIntent(launch)
      .build()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else {
      0
    }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
  }

  companion object {
    private const val TAG = "SafeKid"
    private const val CHANNEL_ID = "safekid.protection"
    private const val NOTIFICATION_ID = 4210
    const val SYNC_POLL_SECONDS = 60L

    /** True while the service is alive in this process (OEMs may kill it). */
    @Volatile var isRunning = false
      private set

    /** Returns false if the system refused to start it (e.g. background start limits). */
    fun start(context: Context): Boolean {
      if (!DeviceSession.get(context).isLinked) return false
      return runCatching {
        ContextCompat.startForegroundService(context, Intent(context, EnforcementService::class.java))
      }.onFailure { Log.w(TAG, "Could not start enforcement service: ${it.message}") }.isSuccess
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, EnforcementService::class.java))
    }
  }
}
