package uz.safekid.devicecontrol

/** Bridges native events to the JS module when the app is running. */
object DeviceEvents {
  interface Listener {
    fun onPermissionsChanged(permissions: Map<String, String>)
    fun onPolicyApplied(version: Int)
    fun onUnlinked()
  }

  @Volatile var listener: Listener? = null

  fun emitPermissions(permissions: Map<String, String>) = listener?.onPermissionsChanged(permissions)

  fun emitPolicyApplied(version: Int) = listener?.onPolicyApplied(version)

  fun emitUnlinked() = listener?.onUnlinked()
}
