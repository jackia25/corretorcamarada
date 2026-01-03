import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  Handshake,
  Shield,
  Eye,
  FileCheck,
  Users,
  Lock,
  ArrowRight,
  CheckCircle2,
  Building2,
  FileSearch,
  ClipboardList,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Landing() {
  const features = [
    {
      icon: Shield,
      title: 'Proteção Total',
      description: 'Dados sensíveis do imóvel só são liberados após acordo mútuo entre corretores.',
    },
    {
      icon: Handshake,
      title: 'Handshake Digital',
      description: 'Acordos de cooperação claros com divisão de comissão definida antes do acesso.',
    },
    {
      icon: Eye,
      title: 'Rastreabilidade',
      description: 'Histórico completo de quem acessou cada informação e quando.',
    },
    {
      icon: Lock,
      title: 'Anti-Atravessamento',
      description: 'Sistema de denúncias e evidências para proteger sua parceria.',
    },
  ];

  const steps = [
    {
      icon: Building2,
      title: 'Cadastre Imóveis',
      description: 'Captador cadastra imóveis com dados públicos e sensíveis separados.',
    },
    {
      icon: FileSearch,
      title: 'Busque e Solicite',
      description: 'Corretor do comprador encontra imóveis e solicita acesso.',
    },
    {
      icon: FileCheck,
      title: 'Aceite e Acorde',
      description: 'Captador aceita e ambos definem termos de cooperação.',
    },
    {
      icon: Users,
      title: 'Colabore com Segurança',
      description: 'Dados liberados, parceria registrada, comissão garantida.',
    },
  ];

  const benefits = [
    'Endereços protegidos até acordo firmado',
    'Contatos do proprietário seguros',
    'Divisão de comissão documentada',
    'Histórico de acessos auditável',
    'Sistema de denúncias integrado',
    'Transparência total entre partes',
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="container relative py-24 lg:py-32">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary mb-6">
                <Shield className="h-4 w-4" />
                Plataforma segura para corretores
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-6"
            >
              Pare o{' '}
              <span className="gradient-text">atravessamento.</span>
              <br />
              Colabore com confiança.
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Corretor Camarada protege suas negociações imobiliárias. Dados sensíveis só são
              liberados após acordo de cooperação entre corretores, com rastreabilidade total.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="gradient-bg text-lg px-8 gap-2">
                  Começar Agora
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Já tenho conta
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <motion.div
            className="max-w-3xl mx-auto text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-display font-bold mb-4">
              O problema que resolvemos
            </h2>
            <p className="text-lg text-muted-foreground">
              No mercado imobiliário, corretores têm medo de compartilhar imóveis.
              O risco de atravessamento — quando alguém vai direto ao proprietário
              ignorando a parceria — causa desconfiança e prejudica todos.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="card-interactive h-full">
                  <CardContent className="pt-6">
                    <div className="h-12 w-12 rounded-lg gradient-bg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-display font-bold mb-4">
              Como funciona
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Um fluxo simples e seguro para colaboração entre corretores
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <step.icon className="h-8 w-8 text-primary" />
                    </div>
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full gradient-bg text-primary-foreground text-sm font-semibold flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>

                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-border" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-display font-bold mb-6">
                Por que usar o Corretor Camarada?
              </h2>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={benefit}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                    <span>{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <div className="text-center">
                  <ClipboardList className="h-16 w-16 mx-auto text-primary mb-6" />
                  <h3 className="text-2xl font-display font-bold mb-4">
                    Pronto para colaborar com segurança?
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Crie sua conta gratuitamente e comece a proteger suas parcerias hoje.
                  </p>
                  <Link to="/auth?mode=signup">
                    <Button size="lg" className="gradient-bg gap-2">
                      Criar Conta Grátis
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center">
              <Handshake className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">Corretor Camarada</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 Corretor Camarada. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}