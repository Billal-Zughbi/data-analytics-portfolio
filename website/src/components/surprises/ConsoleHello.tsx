"use client";

import { useEffect } from "react";
import { profile } from "@/content/profile";

let said = false;

/** A short hello for anyone who opens the browser console. Renders nothing. */
export function ConsoleHello() {
  useEffect(() => {
    if (said) return;
    said = true;
    console.info(
      `%cHello there, and thanks for looking under the hood!%c\n\nThis site is a static Next.js export. Every chart on it reads JSON that a Python pipeline builds from my Apple Health data, and all of the code is on GitHub:\n${profile.links.repository}\n\nBillal`,
      "font: 600 14px/1.6 system-ui, sans-serif; color: #4fd8ff;",
      "font: 12px/1.6 system-ui, sans-serif; color: inherit;",
    );
  }, []);
  return null;
}
