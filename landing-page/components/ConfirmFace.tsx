"use client";

import { useEffect, useState } from "react";

/* The bot reacting to a proposed action, driven by the parent's `state`. Uses
   the hand-made ASK / ACC / DENY art from /public/tends-bot, inlined so the
   parts animate. The body stays still (no jelly) - all the life is in the eyes:
   they blink, and the content cross-fades between pupils, a green check
   (approved) and an orange X (denied). While asking, the orange "?" stays put
   and gently sways left/right. The body keeps one position across states so the
   change reads as one smooth blink-and-swap. */

const SCLERA = "#D9D9D9";
const BODY = "#1D4D91";

// ACC / DENY art is drawn for eyes at cy174; the shared body here sits lower
// (ASK layout, eyes at cy222), so shift that art down to line up.
const EYE_SHIFT = "translate(0 48)";

export default function ConfirmFace({
  state,
  size = 48,
}: {
  state: "asking" | "approved" | "denied";
  size?: number;
}) {
  const [blink, setBlink] = useState(false);

  // Gentle idle blink.
  useEffect(() => {
    const id = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 150);
    }, 3800);
    return () => clearInterval(id);
  }, []);

  // A blink on every state change hides the eye-content swap.
  useEffect(() => {
    setBlink(true);
    const t = window.setTimeout(() => setBlink(false), 200);
    return () => clearTimeout(t);
  }, [state]);

  const asking = state === "asking";
  const approved = state === "approved";
  const denied = state === "denied";
  const fade = "opacity 0.22s ease";

  return (
    <svg
      viewBox="0 0 449 485"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      <g className={asking ? "cf-wobble" : undefined}>
        <path
          d="M197.528 82.3562C209.459 61.6895 239.289 61.6895 251.221 82.3562L391.841 325.918C403.773 346.584 388.858 372.418 364.995 372.418H83.754C59.8902 372.418 44.9753 346.584 56.9072 325.918L197.528 82.3562Z"
          fill={BODY}
        />

        {/* question mark - pulses while asking, fades out otherwise */}
        <path
          className={asking ? "confirm-q" : undefined}
          d="M321.253 121.735V119.782C321.291 113.081 321.884 107.74 323.033 103.758C324.22 99.7755 325.943 96.5592 328.202 94.1086C330.461 91.6581 333.18 89.4372 336.358 87.4462C338.732 85.9146 340.857 84.3255 342.733 82.679C344.609 81.0326 346.103 79.2138 347.213 77.2227C348.324 75.1933 348.879 72.9342 348.879 70.4454C348.879 67.8034 348.247 65.4868 346.983 63.4957C345.72 61.5047 344.016 59.9731 341.872 58.9009C339.766 57.8288 337.43 57.2928 334.865 57.2928C332.376 57.2928 330.021 57.848 327.8 58.9584C325.579 60.0305 323.761 61.6387 322.344 63.7829C320.927 65.8889 320.161 68.5117 320.046 71.6515H296.613C296.804 63.9935 298.642 57.6757 302.127 52.698C305.611 47.682 310.225 43.9487 315.969 41.4981C321.712 39.0093 328.049 37.7648 334.98 37.7648C342.599 37.7648 349.338 39.0284 355.197 41.5556C361.055 44.0444 365.65 47.6628 368.981 52.4108C372.312 57.1587 373.978 62.8831 373.978 69.5839C373.978 74.0638 373.231 78.046 371.738 81.5303C370.283 84.9765 368.234 88.0397 365.592 90.72C362.95 93.362 359.83 95.7551 356.23 97.8993C353.206 99.699 350.717 101.575 348.764 103.528C346.849 105.481 345.414 107.74 344.456 110.305C343.537 112.871 343.059 116.03 343.02 119.782V121.735H321.253ZM332.625 158.493C328.796 158.493 325.522 157.153 322.803 154.473C320.123 151.754 318.802 148.5 318.84 144.709C318.802 140.956 320.123 137.74 322.803 135.06C325.522 132.38 328.796 131.039 332.625 131.039C336.262 131.039 339.459 132.38 342.216 135.06C344.973 137.74 346.371 140.956 346.409 144.709C346.371 147.236 345.701 149.553 344.399 151.659C343.135 153.726 341.47 155.392 339.402 156.655C337.334 157.881 335.075 158.493 332.625 158.493Z"
          fill="#ED6C30"
          style={{ opacity: asking ? 1 : 0, transition: "opacity 0.25s ease" }}
        />

        <g
          className="cf-eyes"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            transform: `scaleY(${blink ? 0.12 : 1})`,
            transition: "transform 0.13s ease",
          }}
        >
          <ellipse cx="171.097" cy="222.922" rx="44.8617" ry="68.9711" transform="rotate(-5.37711 171.097 222.922)" fill={SCLERA} />
          <ellipse cx="277.652" cy="222.922" rx="44.8617" ry="68.9711" transform="rotate(-5.1 277.652 222.922)" fill={SCLERA} />

          {/* asking: pupils that glance up-right toward the "?" */}
          <g
            style={{
              opacity: asking ? 1 : 0,
              transform: asking ? "translate(5px, -7px)" : "none",
              transition: `${fade}, transform 0.4s cubic-bezier(0.22,1,0.36,1)`,
            }}
          >
            <ellipse cx="181.305" cy="209.58" rx="14.3463" ry="24.9303" fill="#202020" />
            <ellipse cx="283.799" cy="209.58" rx="14.3463" ry="24.9303" fill="#202020" />
          </g>

          {/* approved: green checks */}
          <g transform={EYE_SHIFT} style={{ opacity: approved ? 1 : 0, transition: fade }}>
            <path d="M195.485 180.122C193.036 177.596 189.002 177.533 186.476 179.981L166.21 199.621L156.923 187.955C154.731 185.203 150.723 184.748 147.97 186.939C145.218 189.131 144.764 193.139 146.954 195.891L160.491 212.893C160.653 213.11 160.829 213.32 161.022 213.52C163.471 216.046 167.504 216.11 170.03 213.662L195.344 189.132C197.87 186.683 197.933 182.649 195.485 180.122Z" fill="#05BE49" />
            <path d="M303.903 180.122C301.455 177.596 297.42 177.533 294.894 179.981L274.628 199.621L265.341 187.955C263.149 185.203 259.141 184.748 256.388 186.939C253.636 189.131 253.182 193.139 255.373 195.891L268.909 212.893C269.071 213.11 269.247 213.32 269.44 213.52C271.889 216.046 275.922 216.11 278.448 213.662L303.762 189.132C306.288 186.683 306.352 182.649 303.903 180.122Z" fill="#05BE49" />
          </g>

          {/* denied: orange X */}
          <g transform={EYE_SHIFT} style={{ opacity: denied ? 1 : 0, transition: fade }}>
            <path d="M156.618 172.142C159.384 169.969 163.389 170.449 165.563 173.215L172.262 181.741L180.585 174.789C183.285 172.533 187.302 172.894 189.558 175.594C191.813 178.293 191.453 182.31 188.754 184.566L180.137 191.765L187.477 201.105C189.651 203.872 189.169 207.877 186.403 210.051C183.636 212.224 179.632 211.744 177.459 208.977L170.356 199.937L161.535 207.308C158.835 209.564 154.818 209.204 152.562 206.505C150.306 203.805 150.666 199.787 153.366 197.531L162.48 189.915L155.545 181.087C153.371 178.32 153.852 174.316 156.618 172.142Z" fill="#ED6C30" />
            <path d="M292.131 172.142C289.365 169.969 285.359 170.448 283.186 173.214L276.486 181.741L268.164 174.789C265.464 172.533 261.446 172.894 259.19 175.593C256.935 178.293 257.296 182.31 259.995 184.566L268.611 191.764L261.271 201.105C259.098 203.872 259.579 207.877 262.346 210.05C265.112 212.223 269.116 211.743 271.29 208.977L278.393 199.937L287.214 207.308C289.914 209.564 293.931 209.204 296.187 206.505C298.442 203.805 298.083 199.787 295.383 197.531L286.269 189.915L293.204 181.087C295.377 178.32 294.897 174.316 292.131 172.142Z" fill="#ED6C30" />
          </g>
        </g>
      </g>
    </svg>
  );
}
