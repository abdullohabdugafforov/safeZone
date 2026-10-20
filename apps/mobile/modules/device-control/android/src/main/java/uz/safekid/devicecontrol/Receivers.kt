package uz.safekid.devicecontrol

import android.app.admin.DeviceAdminReceiver
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors

private val background = Executors.newSingleThreadExecutor()

/** Reports on a worker thread but waits up to 3 s, so the alert leaves before the app may die. */
private fun reportBlocking(context: Context, type: String) {
  val app = context.applicationContext
  val worker = Thread { runCatching { SyncEngine(app).reportAlert(type) } }
  worker.start()
  worker.join(3_000)
}

private fun reportAsync(context: Context, type: String) {
  val app = context.applicationContext
  background.execute { runCatching { SyncEngine(app).reportAlert(type) } }
}

/** Active device admin = SafeKid cannot be uninstalled until it is turned off (parent is alerted). */
class SafeKidDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
    // Send before the user can confirm: the app may be uninstalled right after.
    reportBlocking(context, "DEVICE_ADMIN_DISABLE_REQUESTED")
    return context.getString(R.string.safekid_device_admin_disable_warning)
  }

  override fun onDisabled(context: Context, intent: Intent) {
    reportAsync(context, "DEVICE_ADMIN_DISABLED")
  }
}

/** Restarts protection after reboot or app update. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      EnforcementService.start(context)
    }
  }
}
