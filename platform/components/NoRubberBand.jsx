export default function NoRubberBand() {
  return (
    <style jsx global>{`
      html,
      body {
        overscroll-behavior-y: none;
      }
    `}</style>
  )
}
