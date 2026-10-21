package uz.safekid.devicecontrol

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class Credentials(
  val apiUrl: String,
  val deviceId: String,
  val accessToken: String,
  val refreshToken: String,
)

/**
 * Persistent device state in app-private storage. Tokens are encrypted with an
 * AES-GCM key that never leaves the Android Keystore. The policy is not secret.
 */
class DeviceStore(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences("safekid.device", Context.MODE_PRIVATE)

  // --- credentials ---

  fun credentials(): Credentials? {
    val apiUrl = prefs.getString(KEY_API_URL, null) ?: return null
    val deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: return null
    val access = prefs.getString(KEY_ACCESS, null)?.let(Crypto::decrypt) ?: return null
    val refresh = prefs.getString(KEY_REFRESH, null)?.let(Crypto::decrypt) ?: return null
    return Credentials(apiUrl, deviceId, access, refresh)
  }

  fun saveCredentials(credentials: Credentials) {
    prefs.edit()
      .putString(KEY_API_URL, credentials.apiUrl.trimEnd('/'))
      .putString(KEY_DEVICE_ID, credentials.deviceId)
      .putString(KEY_ACCESS, Crypto.encrypt(credentials.accessToken))
      .putString(KEY_REFRESH, Crypto.encrypt(credentials.refreshToken))
      .apply()
  }

  fun updateTokens(accessToken: String, refreshToken: String) {
    prefs.edit()
      .putString(KEY_ACCESS, Crypto.encrypt(accessToken))
      .putString(KEY_REFRESH, Crypto.encrypt(refreshToken))
      .commit()
  }

  /** Forgets everything: credentials and policy (device no longer managed). */
  fun clear() {
    prefs.edit().clear().commit()
  }

  // --- policy ---

  fun policyJson(): JSONObject? = prefs.getString(KEY_POLICY, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  fun policy(): Policy? = policyJson()?.let { runCatching { Policy.fromJson(it) }.getOrNull() }

  fun appliedPolicyVersion(): Int? = if (prefs.contains(KEY_POLICY_VERSION)) prefs.getInt(KEY_POLICY_VERSION, 0) else null

  /** Validates before storing; a malformed policy never replaces a good one. */
  fun savePolicy(json: JSONObject): Policy {
    val policy = Policy.fromJson(json)
    prefs.edit().putString(KEY_POLICY, json.toString()).putInt(KEY_POLICY_VERSION, policy.version).commit()
    return policy
  }

  // --- last reported permissions (for tamper detection) ---

  fun lastPermissions(): Map<String, String> =
    prefs.getString(KEY_LAST_PERMISSIONS, null)?.let { raw ->
      val json = JSONObject(raw)
      json.keys().asSequence().associateWith { json.getString(it) }
    } ?: emptyMap()

  fun saveLastPermissions(permissions: Map<String, String>) {
    prefs.edit().putString(KEY_LAST_PERMISSIONS, JSONObject(permissions).toString()).apply()
  }

  // --- other user space (second space) ---

  fun otherSpaceSince(): Long? = if (prefs.contains(KEY_OTHER_SPACE)) prefs.getLong(KEY_OTHER_SPACE, 0) else null

  fun setOtherSpaceSince(time: Long?) {
    prefs.edit().apply { if (time == null) remove(KEY_OTHER_SPACE) else putLong(KEY_OTHER_SPACE, time) }.apply()
  }

  fun registerListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) =
    prefs.registerOnSharedPreferenceChangeListener(listener)

  fun unregisterListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) =
    prefs.unregisterOnSharedPreferenceChangeListener(listener)

  companion object {
    const val KEY_POLICY = "policy"
    private const val KEY_POLICY_VERSION = "policyVersion"
    private const val KEY_API_URL = "apiUrl"
    private const val KEY_DEVICE_ID = "deviceId"
    private const val KEY_ACCESS = "accessToken"
    private const val KEY_REFRESH = "refreshToken"
    private const val KEY_LAST_PERMISSIONS = "lastPermissions"
    private const val KEY_OTHER_SPACE = "otherSpaceSince"
  }
}

/** AES-256-GCM with a non-exportable Android Keystore key. */
private object Crypto {
  private const val ALIAS = "safekid.device.key"
  private const val TRANSFORMATION = "AES/GCM/NoPadding"

  private fun key(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  fun encrypt(plain: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
    val encrypted = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)
  }

  fun decrypt(encoded: String): String? = runCatching {
    val bytes = Base64.decode(encoded, Base64.NO_WRAP)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
    String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }.getOrNull()
}
