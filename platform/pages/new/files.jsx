import { useEffect, useState } from 'react'

import { getAccept } from '@/lib/mime'

import Wizard, {
  FormContainer,
  Heading,
  NavigationButtons,
  useWizard,
} from '@/layouts/Wizard'

import FileManager from '@/components/FileManager'

export default function Page() {
  const { values, setValues } = useWizard()

  const [files, setFiles] = useState([])

  useEffect(() => {
    setValues((values) => ({
      ...values,

      files,
    }))
  }, [setValues, files])

  return (
    <>
      <Heading
        title="What's in your dataset?"
        description="Upload documents that will give your bot the knowledge it needs to operate. These files will be the brains of your chatbot!"
      />
      <FormContainer>
        {/* file upload */}
        <div>
          <label className="default-label" htmlFor="file-upload">
            File Upload
          </label>
          <div className="mt-1">
            <FileManager
              files={values.files}
              setFiles={setFiles}
              accept={getAccept}
            />
          </div>
          <p className="input-description">
            Upload documents to build your solution&apos;s knowledge base.
            We&apos;ll process and structure the content so your bot can
            reference it accurately. You can add or remove files at any time.
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
      title="Docs"
      description="A dataset is used to provide additional context and information to a chatbot. You can point to any document including PDF, DOCX, MP3, MPEG and others."
    >
      {children}
    </Wizard>
  )
}
