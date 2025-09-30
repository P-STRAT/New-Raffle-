import AbstractProvider from './components/AbstractProvider';
import './global.css';

export const metadata = {
  title: 'Raffle dApp',
  description: 'Create and manage raffles on Abstract',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AbstractProvider>
          {children}
        </AbstractProvider>
      </body>
    </html>
  );
}