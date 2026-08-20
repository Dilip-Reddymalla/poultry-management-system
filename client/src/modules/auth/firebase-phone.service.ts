import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

import { auth } from "../../config/firebase.js";

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function initializeRecaptcha(
  containerId: string,
): RecaptchaVerifier {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    containerId,
    {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved.
      },
      "expired-callback": () => {
        recaptchaVerifier = null;
      },
    },
  );

  return recaptchaVerifier;
}

export async function sendFirebaseOtp(
  phone: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const verifier = initializeRecaptcha(containerId);

  return signInWithPhoneNumber(
    auth,
    phone,
    verifier,
  );
}