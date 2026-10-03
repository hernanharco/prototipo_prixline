import { UserCheck, Briefcase, Rocket } from 'lucide-react';
import { motion } from 'motion/react';

const features = [
  {
    title: "Tutoría Personalizada",
    description: "No estarás solo. Un mentor experto te acompañará durante todo tu proceso de aprendizaje.",
    icon: <UserCheck className="w-8 h-8 text-accent" />,
  },
  {
    title: "Prácticas Garantizadas",
    description: "Conectamos tu talento con empresas reales. Aplica lo aprendido en entornos profesionales.",
    icon: <Briefcase className="w-8 h-8 text-accent" />,
  },
  {
    title: "Bolsa de Empleo",
    description: "Accede a ofertas exclusivas de nuestra red de partners al finalizar tu formación.",
    icon: <Rocket className="w-8 h-8 text-accent" />,
  },
];

export function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-primary mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
