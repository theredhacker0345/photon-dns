package expo.modules.pockethermessupervisor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restores the host only after Android has completed normal boot and only when
 * the owner explicitly opted into recovery. It contains no credential parsing;
 * the service reads its Keystore-backed configuration after launch.
 */
class PocketHermesBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!PocketHermesSupervisorService.shouldRestartAfterBoot(context)) return
    PocketHermesSupervisorService.startFromPersistedConfiguration(context)
  }
}
