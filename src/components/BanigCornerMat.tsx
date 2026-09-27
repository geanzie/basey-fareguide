/**
 * A round banig mat laid into a panel's bottom-left corner, so its rim sweeps
 * diagonally from the left edge down past the right edge, the way the round
 * mats sit in the source photo. The parent must be `relative overflow-hidden`.
 *
 * The mat is an ellipse 115% of the parent's width by 56% of its height,
 * centred on the bottom-left corner, so just under half the parent is covered.
 * A tikog-coloured binding and a soft shadow lift it off the forest.
 *
 * `className` decides where it shows (e.g. `hidden lg:block`).
 */
const BanigCornerMat = ({ className = '' }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute bottom-[calc(var(--ry)*-1)] left-[calc(var(--rx)*-1)] h-[calc(var(--ry)*2)] w-[calc(var(--rx)*2)] overflow-hidden rounded-[50%] shadow-[0_0_0_6px_#E6D3A8,0_0_0_7px_rgba(0,0,0,0.25),0_24px_60px_rgba(0,0,0,0.45)] [--rx:115%] [--ry:56%] ${className}`}
  >
    {/* Only the ellipse's top-right quarter can be on screen; the photo fills just that. */}
    <div className="absolute left-1/2 top-0 h-1/2 w-1/2 bg-[url('/brand/banig-disc.webp')] bg-cover bg-left-top" />
  </div>
)

export default BanigCornerMat
