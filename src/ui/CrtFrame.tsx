/** Purely decorative CRT shell: the plastic bezel around the tube, nothing on
 *  the glass itself. The whole tree is pointer-events:none so the globe keeps
 *  every drag and wheel. */
export function CrtFrame() {
  return (
    <div className="crt" aria-hidden="true">
      {/* the plastic around the tube: one rounded hole, everything outside it painted */}
      <div className="crt-bezel">
        <div className="crt-bezel-lip" />
        <span className="crt-screw crt-screw-tl" />
        <span className="crt-screw crt-screw-tr" />
        <span className="crt-screw crt-screw-bl" />
        <span className="crt-screw crt-screw-br" />
      </div>

      <div className="crt-plate">
        <span className="crt-led" />
        <span className="crt-plate-text">ORBITAL&nbsp;&nbsp;OS-9</span>
        <span className="crt-plate-vents" />
      </div>
    </div>
  );
}
