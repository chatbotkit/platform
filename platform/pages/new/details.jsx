import Wizard, {
  FormContainer,
  Heading,
  NavigationButtons,
  useWizard,
} from '@/layouts/Wizard'

import DescriptionInput from '@/components/DescriptionInput'
import NameInput from '@/components/NameInput'

export default function Page() {
  const { values, setValues } = useWizard()

  return (
    <>
      <Heading
        title="Name Your Solution"
        description="Choose a memorable name and description that clearly represents what your solution does."
      />
      <FormContainer>
        {/* name */}
        <div>
          <label className="default-label" htmlFor="name">
            Name
          </label>
          <div className="mt-1">
            <NameInput
              className="default-input w-full"
              name="name"
              autoFocus
              type="text"
              value={values.name || ''}
              onChange={(e) =>
                setValues((values) => ({ ...values, name: e.target.value }))
              }
              required
            />
          </div>
          <p className="input-description">
            Choose a clear, memorable name that reflects your solution&apos;s
            purpose.
          </p>
        </div>
        {/* description */}
        <div>
          <label className="default-label" htmlFor="description">
            Description
          </label>
          <div className="mt-1">
            <DescriptionInput
              className="default-input"
              name="description"
              type="text"
              rows={6}
              value={values.description || ''}
              onChange={(e) =>
                setValues((values) => ({
                  ...values,
                  description: e.target.value,
                }))
              }
              required
            />
          </div>
          <p className="input-description">
            Describe what your solution does. This helps us structure and
            optimize your solution for the best results.
          </p>
        </div>
      </FormContainer>
      <NavigationButtons />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Create Solution"
      title="Details"
      description="Provide a name and description for your solution."
    >
      {children}
    </Wizard>
  )
}
