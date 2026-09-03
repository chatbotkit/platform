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
    setValues((values) => {
      return {
        ...values,

        files: files,
      }
    })
  }, [files, setValues])

  return (
    <>
      <Heading
        title="What's in your dataset?"
        description="Add more documents to enhance your bot's knowledge and enable it to function effectively. These files will become an integral part of your chatbot's intelligence!"
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
              accept={getAccept([
                '.md',
                '.txt',
                '.pdf',
                '.docx',
                '.pptx',
                '.xlsx',
                '.csv',
                '.json',
                '.yaml',
                '.html',
              ])}
            />
          </div>
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
      description="A dataset is used to provide additional context and information to a chatbot. You can point to any document including PDF, DOCX and others."
    >
      {children}
    </Wizard>
  )
}
