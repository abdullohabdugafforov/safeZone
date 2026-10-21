package uz.safekid.devicecontrol

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.UserManager
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

/**
 * Detects switching to another Android user (Xiaomi "Second space" and OEM
 * equivalents). SafeKid only runs in the main space, so the parent is told
 * right away and the device reports `inOtherSpace` until the child returns.
 */
object SpaceWatcher {
  private const val TAG = "SafeKid"
  private val worker = Executors.newSingleThreadExecutor()
  @Volatile private var registered = false

  /** Idempotent: safe to call from every service start. */
  fun register(context: Context) {
    if (registered) return
    registered = true
    val app = context.applicationContext
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_USER_BACKGROUND)
      addAction(Intent.ACTION_USER_FOREGROUND)
    }
    ContextCompat.registerReceiver(app, Receiver(), filter, ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  /** True when another user is in the foreground (Android 12+); falls back to the last broadcast seen. */
  fun isInOtherSpace(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val um = context.getSystemService(Context.USER_SERVICE) as UserManager
      return runCatching { !um.isUserForeground }.getOrElse { DeviceStore(context).otherSpaceSince() != null }
    }
    return DeviceStore(context).otherSpaceSince() != null
  }

  private class Receiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val app = context.applicationContext
      val store = DeviceSession.get(app).store
      if (!DeviceSession.get(app).isLinked) return
      when (intent.action) {
        Intent.ACTION_USER_BACKGROUND -> {
          if (store.otherSpaceSince() == null) store.setOtherSpaceSince(System.currentTimeMillis())
          report(app) {
            SyncEngine(app).reportAlert("SECOND_SPACE_ENTERED")
            SyncEngine(app).heartbeat()
          }
        }
        Intent.ACTION_USER_FOREGROUND -> {
          val since = store.otherSpaceSince() ?: return
          store.setOtherSpaceSince(null)
          val minutes = ((System.currentTimeMillis() - since) / 60_000).toInt().coerceAtLeast(0)
          report(app) {
            SyncEngine(app).reportAlert("SECOND_SPACE_LEFT", mapOf("minutes" to minutes))
            SyncEngine(app).heartbeat()
          }
        }
      }
    }

    private fun report(context: Context, block: () -> Unit) {
      worker.execute {
        runCatching(block).onFailure { Log.w(TAG, "Space report failed: ${it.javaClass.simpleName}: ${it.message}") }
      }
    }
  }
}
