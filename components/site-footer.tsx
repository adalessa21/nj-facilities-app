export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6 text-xs text-gray-400 leading-relaxed">
        Contract data is provided for informational purposes only and does not constitute a legal
        eligibility determination. Verify current pricing, terms, and cooperative membership
        requirements with the issuing cooperative or lead agency, and consult your purchasing
        counsel before award.{' '}
        © {new Date().getFullYear()} NJ Facilities Procurement Platform
      </div>
    </footer>
  )
}
