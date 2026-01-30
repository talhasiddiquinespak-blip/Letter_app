import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Letter Scanner',
  description: 'Automated document scanning and registry',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  )
}
