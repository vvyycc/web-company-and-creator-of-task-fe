import Head from 'next/head';
import ContactSection from '@/components/ContactSection';
import Hero from '@/components/Hero';
import HowItWorksSection from '@/components/HowItWorksSection';
import ServicesSection from '@/components/ServicesSection';

export default function Home() {
  return (
    <>
      <Head>
        <title>B-Chain Automation Studio | Automatización, Web3 y Backend</title>
        <meta
          name="description"
          content="Soluciones de automatización, blockchain y backend a medida. Construimos bots, smart contracts, APIs y aplicaciones modernas para tu negocio."
        />
      </Head>
      <div className="min-h-screen bg-white">
        <Hero />
        <ServicesSection />
        <HowItWorksSection />
        <ContactSection />
        <footer className="border-t border-slate-100 bg-slate-50 py-8">
          <div className="section-container flex flex-col gap-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-800">B-Chain Automation Studio</p>
              <p>contacto@bchainstudio.com</p>
            </div>
            <div className="flex items-center gap-4">
              <a href="#contact" className="underline decoration-primary-400 decoration-2 underline-offset-4">
                Ir a contacto
              </a>
              <span className="text-slate-400">|</span>
              <span>Automatización · Web3 · Backend</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
