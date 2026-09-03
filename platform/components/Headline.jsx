export default function Headline({ title, beta, children, ...props }) {
  return (
    <div {...props} id={title?.toLowerCase?.().replace(/\W+/g, '-')}>
      <h2 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
        {title}
        {beta ? (
          <sup className="beta">
            {typeof beta === 'boolean' ? 'BETA' : beta}
          </sup>
        ) : null}
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
        {children}
      </p>
    </div>
  )
}
