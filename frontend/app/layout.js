export const metadata = {
  title: 'Ano Tara',
  description: 'Frontend for CNN, MLR, and Decision Trees workflows',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
