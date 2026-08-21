import { meterParts } from "./term";

/** Two spans, not one string: a solid `░` track drawn at full strength reads as
 *  a full bar rather than an empty one. */
export function Meter({ value, max, cols }: { value: number; max: number; cols: number }) {
  const [on, off] = meterParts(value, max, cols);
  return (
    <>
      <span className="mtr-on">{on}</span>
      <span className="mtr-off">{off}</span>
    </>
  );
}
