package uz.safekid.devicecontrol

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/** JS bridge; see modules/device-control/src/DeviceControl.types.ts for the contract. */
class DeviceControlModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val session get() = DeviceSession.get(context)

  override fun definition() = ModuleDefinition {
    Name("DeviceControl")

    Events("onPermissionsChanged", "onPolicyApplied", "onUnlinked")

    OnCreate {
      DeviceEvents.listener = object : DeviceEvents.Listener {
        override fun onPermissionsChanged(permissions: Map<String, String>) =
          sendEvent("onPermissionsChanged", mapOf("permissions" to permissions))

        override fun onPolicyApplied(version: Int) = sendEvent("onPolicyApplied", mapOf("version" to version))

        override fun onUnlinked() = sendEvent("onUnlinked", emptyMap<String, Any>())
      }
    }

    OnDestroy { DeviceEvents.listener = null }

    // Returning from system settings: let JS refresh the permission UI.
    OnActivityEntersForeground {
      appContext.reactContext?.let { sendEvent("onPermissionsChanged", mapOf("permissions" to Permissions.status(it))) }
    }

    Function("getCapabilities") {
      mapOf(
        "requiredPermissions" to Permissions.REQUIRED,
        "canListInstalledApps" to true,
        "canProtectUninstall" to true,
      )
    }

    AsyncFunction("getPermissionStatus") { Permissions.status(context) }

    AsyncFunction("requestPermission") { kind: String ->
      val intent = Permissions.settingsIntent(context, kind) ?: throw IllegalArgumentException("Unsupported permission $kind")
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // App's system settings page: needed for "Allow restricted settings" (Android 13+,
    // apps installed outside a store) and OEM autostart/background toggles.
    AsyncFunction("openAppSettings") {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("setDeviceCredentials") { creds: Map<String, Any?> ->
      session.store.saveCredentials(
        Credentials(
          apiUrl = creds["apiUrl"] as String,
          deviceId = creds["deviceId"] as String,
          accessToken = creds["accessToken"] as String,
          refreshToken = creds["refreshToken"] as String,
        ),
      )
    }

    AsyncFunction("clearDeviceCredentials") {
      EnforcementService.stop(context)
      session.store.clear()
    }

    AsyncFunction("getAccessToken") { session.accessToken() }

    AsyncFunction("applyPolicy") { policy: Map<String, Any?> ->
      SyncEngine(context).applyPolicy(JSONObject(policy))
    }

    AsyncFunction("syncNow") { SyncEngine(context).syncNow() }

    AsyncFunction("getInstalledApps") {
      InstalledApps.list(context).map { mapOf("appId" to it.appId, "label" to it.label, "isSystem" to it.isSystem) }
    }

    AsyncFunction("startEnforcement") {
      EnforcementService.start(context)
      // Give the parent something to choose from right away.
      runCatching { SyncEngine(context).reportApps() }
      Unit
    }

    AsyncFunction("getStatus") {
      mapOf(
        "running" to (session.isLinked && EnforcementService.isRunning),
        "appliedPolicyVersion" to session.store.appliedPolicyVersion(),
        "permissions" to Permissions.status(context),
      )
    }
  }
}
