import { DATA_VERIFIED, IS_PREVIEW_BUILD, SHARES_VERIFIED } from '../config'

interface PreviewBadgeProps {
  show?: boolean
  dataVerified?: boolean
  sharesVerified?: boolean
}

/** Prints the compiled flag values on Preview builds so a reviewer can see which view they are looking at. */
export default function PreviewBadge({ show = IS_PREVIEW_BUILD, dataVerified = DATA_VERIFIED, sharesVerified = SHARES_VERIFIED }: PreviewBadgeProps) {
  if (!show) return null
  return (
    <p className="preview-badge" role="note">
      Preview build · DATA_VERIFIED={String(dataVerified)} · SHARES_VERIFIED={String(sharesVerified)}
    </p>
  )
}
