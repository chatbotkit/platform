import { memo, useState } from 'react'

import { pdf2text } from '@chatbotkit-dev/file-pdf/parse'

import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import CodeBlock from '@/components/CodeBlock'
import FAQ from '@/components/FAQ'
import FileDrop from '@/components/FileDrop'
import NavHeader from '@/components/NavHeader'

import faq from '@/content/faqs/website-playground-pdf.yaml'

export function DataViewer({ output }) {
  return output ? (
    <CodeBlock className="text-sm max-h-96" language="text">
      {output}
    </CodeBlock>
  ) : null
}

DataViewer.Memo = memo(DataViewer)

export default function Index() {
  const [output, setOutput] = useState('')
  const [fileName, setFileName] = useState('')

  async function handleDrop(files) {
    if (files.length === 0) {
      return
    }

    const file = files[0]

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')

      return
    }

    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const data = new Uint8Array(buffer)
      const text = await pdf2text(data)

      setOutput(text)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <section className="section-white">
        <div className="main-page">
          <NavHeader
            link="/playground"
            caption="playgrounds"
            title="PDF"
            beta={true}
          >
            The PDF tester playground allows you to test how PDF documents are
            converted to simplified text, suitable for use in conversational AI
            applications.
          </NavHeader>
          <FileDrop
            onDrop={handleDrop}
            accept={{ 'application/pdf': ['.pdf'] }}
          />
          {fileName && (
            <div className="text-sm text-gray-500">
              Uploaded: <strong>{fileName}</strong>
            </div>
          )}
          <DataViewer.Memo output={output} />
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="PDF to Text Playground"
      description="The PDF to Text playground allows you to test how PDF documents are converted to simplified text, suitable for use in conversational AI applications"
      keywords="pdf tester, pdf to text, chatbot, playground"
      image={`/playground/pdf/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 150
 *
 * ## PDF
 *
 * The [PDF Playground](https://chatbotkit.com/playground/pdf) helps you inspect how PDF documents are converted into text. It is useful when you need to validate document extraction quality before relying on PDFs in search, knowledge, or automation workflows.
 *
 * Use it to test real files, review extracted output, and catch formatting or parsing issues early.
 */
