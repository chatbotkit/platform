import CommaListSelect from '@/components/CommaListSelect'

export default function MultiLanguageSelect({ ...props }) {
  return (
    <CommaListSelect
      placeholder="Type the language and press enter..."
      {...props}
    />
  )
}
