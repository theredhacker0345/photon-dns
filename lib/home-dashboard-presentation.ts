import type { ComponentProps } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import type { HostPhase } from "@/lib/pocket-hermes-store";

export type HomePhasePresentation = {
  title: string;
  detail: string;
  nextStep: string;
  nextDetail: string;
  nextIcon: ComponentProps<typeof MaterialIcons>["name"];
};

const phasePresentation: Record<HostPhase, HomePhasePresentation> = {
  unconfigured: {
    title: "Make this phone a private agent host.",
    detail: "Connect one Telegram bot and lock it to your own chat before anything can run.",
    nextStep: "Configure the host",
    nextDetail: "Add the private owner gateway, model, and safe runtime policy.",
    nextIcon: "lock-outline",
  },
  ready: {
    title: "Your private host is ready.",
    detail: "The owner gateway is configured. Confirm device readiness, then start supervision.",
    nextStep: "Start the supervisor",
    nextDetail: "Keep this device charging and let Android supervise the embedded runtime.",
    nextIcon: "play-arrow",
  },
  running: {
    title: "Your private host is supervised.",
    detail: "Android is monitoring this phone’s host-process CPU and RAM in the foreground.",
    nextStep: "Monitor this phone",
    nextDetail: "Check live usage and leave local alerts on before leaving the host unattended.",
    nextIcon: "verified",
  },
  bridge_required: {
    title: "Your control plane is ready.",
    detail: "The preview stores setup locally. The installed Android build adds the bundled runtime supervisor.",
    nextStep: "Use the Android build",
    nextDetail: "Install the APK to connect this control plane to the native foreground supervisor.",
    nextIcon: "phone-android",
  },
  stopped: {
    title: "Your host is paused.",
    detail: "No new runtime session will be requested until you prepare the host again.",
    nextStep: "Prepare the runtime",
    nextDetail: "Recheck charging and storage, then resume local supervision when this device is ready.",
    nextIcon: "play-arrow",
  },
};

export function getHomePhasePresentation(phase: HostPhase): HomePhasePresentation {
  return phasePresentation[phase];
}
