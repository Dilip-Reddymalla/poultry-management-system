import { useRef, useState } from "react";

import type { ConfirmationResult } from "firebase/auth";

import { sendFirebaseOtp } from "./firebase-phone.service";

export default function FirebasePhoneTest() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const confirmationResultRef =
    useRef<ConfirmationResult | null>(null);

  async function handleSendOtp() {
    try {
      setMessage("Sending OTP...");

      const confirmationResult =
        await sendFirebaseOtp(
          phone,
          "recaptcha-container",
        );

      confirmationResultRef.current =
        confirmationResult;

      setMessage("OTP sent successfully.");
    } catch (error) {
      console.error(error);

      setMessage(
        "Failed to send OTP.",
      );
    }
  }

  return (
    <div>
      <input
        type="tel"
        placeholder="+919876543210"
        value={phone}
        onChange={(event) =>
          setPhone(event.target.value)
        }
      />

      <button
        type="button"
        onClick={handleSendOtp}
      >
        Send OTP
      </button>

      <div id="recaptcha-container" />

      <p>{message}</p>
    </div>
  );
}