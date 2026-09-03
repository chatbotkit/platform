import clsx from 'clsx'

export default function PartnerBanner({ partner, className, ...props }) {
  return (
    <div {...props} className={clsx(className)}>
      {partner.logo ? (
        <img
          className="h-[1em] dark:invert"
          src={partner.logo}
          alt={partner.name}
        />
      ) : (
        <span className="font-semibold">{partner.name}</span>
      )}
    </div>
  )
}
