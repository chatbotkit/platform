import clsx from 'clsx'

export function CategoryContent({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'category-content',
        'grid col-span-2 sm:grid-cols-3 gap-4',
        'text-base',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CategoryItem({ className, children, title, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'category-item',
        'grid gap-6',
        'pt-6 pb-12',
        {
          'sm:grid-cols-3': !!title,
          'sm:grid-cols-2': !title,
        },
        className
      )}
    >
      {title ? (
        <h2 className="category-item-title col-span-1 text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
      ) : null}
      <CategoryContent className="category-item-content">
        {children}
      </CategoryContent>
    </div>
  )
}

export function CategoryGrid({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'category-grid',
        'flex flex-col gap-4',
        '[&_.category-item:not(:first-child)]:border-t [&_.category-item:not(:first-child)]:border-gray-100 dark:[&_.category-item:not(:first-child)]:border-gray-900',
        className
      )}
    >
      {children}
    </div>
  )
}

CategoryGrid.Item = CategoryItem
CategoryGrid.Content = CategoryContent

export default CategoryGrid
