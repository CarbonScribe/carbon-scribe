import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PortalNavbar from "@/components/PortalNavbar";
import PortalSidebar from "@/components/PortalSidebar";
import { FarmerProvider } from "@/contexts/FarmerContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CarbonScribe Project Portal - Farmer Dashboard",
  description:
    "Manage your regenerative agriculture projects and carbon credits",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-linear-to-br from-emerald-50 via-white to-cyan-50 min-h-screen`}
      >
        <FarmerProvider>
          <PortalNavbar />
          <div className="flex">
            <PortalSidebar />
            <main className="flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300">
              {children}
            </main>
          </div>
        </FarmerProvider>
      </body>
    </html>
  );
}

// import type { Metadata } from 'next';
// import { Inter } from 'next/font/google';
// import './globals.css';
// import PortalNavbar from '@/components/PortalNavbar';
// import PortalSidebar from '@/components/PortalSidebar';
// import { FarmerProvider } from '@/contexts/FarmerContext';

// const inter = Inter({ subsets: ['latin'] });

// export const metadata: Metadata = {
//   title: 'CarbonScribe Project Portal - Farmer Dashboard',
//   description: 'Manage your regenerative agriculture projects and carbon credits',
// };

// export default function ProjectPortalLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <FarmerProvider>
//       <div className={`${inter.className} bg-linear-to-br from-emerald-50 via-white to-cyan-50 min-h-screen`}>
//         <PortalNavbar />
//         <div className="flex">
//           <PortalSidebar />
//           <main className="flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300">
//             {children}
//           </main>
//         </div>
//       </div>
//     </FarmerProvider>
//   );
// }
