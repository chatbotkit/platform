import CommaListSelect from '@/components/CommaListSelect'

export default function WidgetPluginsSelect({ ...props }) {
  return (
    <CommaListSelect
      placeholder="Type the plugin and press enter..."
      {...props}
    />
  )
}
