package uz.safekid.devicecontrol

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Full-screen block screen drawn by the accessibility service (no overlay permission needed). */
class BlockOverlay(private val service: AccessibilityService) {
  private val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var view: View? = null
  private var shownReason: Decision.Reason? = null

  val isShowing: Boolean get() = view != null

  fun show(reason: Decision.Reason) {
    if (shownReason == reason && view != null) return
    hide()
    val content = build(reason)
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.OPAQUE,
    )
    windowManager.addView(content, params)
    view = content
    shownReason = reason
  }

  fun hide() {
    view?.let { runCatching { windowManager.removeView(it) } }
    view = null
    shownReason = null
  }

  private fun build(reason: Decision.Reason): View {
    val ctx = service
    val (title, body) = when (reason) {
      Decision.Reason.NOT_ALLOWED -> R.string.safekid_blocked_title to R.string.safekid_blocked_body
      else -> R.string.safekid_locked_title to R.string.safekid_locked_body
    }
    return LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#121826"))
      val pad = dp(32)
      setPadding(pad, pad, pad, pad)
      addView(text(ctx, ctx.getString(title), 26f, bold = true))
      addView(text(ctx, ctx.getString(body), 17f, bold = false).apply { setPadding(0, dp(16), 0, dp(32)) })
      if (reason == Decision.Reason.NOT_ALLOWED) {
        addView(
          Button(ctx).apply {
            text = ctx.getString(R.string.safekid_go_home)
            setOnClickListener { service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME) }
          },
        )
      }
    }
  }

  private fun text(ctx: Context, value: String, size: Float, bold: Boolean) = TextView(ctx).apply {
    text = value
    setTextColor(Color.WHITE)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    gravity = Gravity.CENTER
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }

  private fun dp(value: Int) = (value * service.resources.displayMetrics.density).toInt()
}
