import Wizard, {
  FormContainer,
  Heading,
  NavigationButtons,
  useWizard,
} from '@/layouts/Wizard'

export default function Page() {
  const { values, setValues, options } = useWizard()

  const optional = options?.website?.optional

  return (
    <>
      <Heading
        title="Where is the website?"
        description="Use this page to configure the URL of the website you wish to import and keep in sync. Enter the URL in the input field below, then proceed to the next step."
      />
      <FormContainer>
        {/* url */}
        <div>
          <label className="default-label" htmlFor="url">
            URL{optional ? ' (Optional)' : ''}
          </label>
          <div className="mt-1">
            <input
              className="default-input w-full"
              name="url"
              type="url"
              placeholder="URL"
              rows={6}
              onChange={(e) =>
                setValues({ ...values, websiteURL: e.target.value })
              }
              pattern="^https?://.+?"
              required={!optional}
            />
          </div>
          <p className="input-description">
            Enter the website URL to crawl. We&apos;ll extract and structure the
            content to build a comprehensive knowledge base.
          </p>
        </div>
      </FormContainer>
      <NavigationButtons
        disabled={optional ? false : values.websiteURL ? false : true}
      />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Create Solution"
      title="Website"
      description="This is the website address that will make your dataset complete"
    >
      {children}
    </Wizard>
  )
}
