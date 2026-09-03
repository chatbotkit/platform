import DescriptionInput from '@/components/DescriptionInput'
import NameInput from '@/components/NameInput'

export default function GeneralBasicOptions({
  instance,

  additionalNameInstructions,
  additionalDescriptionInstructions,

  magic,

  children,
}) {
  return (
    <>
      {/* name */}
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <NameInput
            className="default-input w-full"
            name="name"
            type="text"
            defaultValue={instance.name || ''}
          />
        </div>
        <p className="input-description">
          Enter a name to distinguish this from the rest.{' '}
          {additionalNameInstructions}
        </p>
      </div>
      {/* description */}
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <DescriptionInput
            className="default-input w-full"
            name="description"
            defaultValue={instance.description || ''}
            magic={magic}
          />
        </div>
        <p className="input-description">
          Optionally write description. {additionalDescriptionInstructions}
        </p>
      </div>
      {children}
    </>
  )
}
