import './globals.css';

export const metadata = {
  title: 'Fiche Comptoir — Nom commercial → DCI',
  description:
    'Nomenclature nationale des produits pharmaceutiques (Algérie), avec favoris, statut Chifa, ruptures de stock et notes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
