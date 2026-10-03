
export function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-primary mb-16">Lo que dicen nuestros estudiantes</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
                {
                    text: "Gracias a Prixline conseguí mis prácticas en una empresa tecnológica líder. La formación es 100% aplicable.",
                    name: "Ana García",
                    role: "Desarrolladora Web",
                    img: "https://i.pravatar.cc/150?img=32"
                },
                {
                    text: "La tutoría personalizada marca la diferencia. Nunca te sientes perdido y siempre hay alguien para guiarte.",
                    name: "Carlos Méndez",
                    role: "Data Analyst",
                    img: "https://i.pravatar.cc/150?img=11"
                },
                {
                    text: "Una inversión que vale la pena. El contenido está actualizado y los proyectos son muy retadores.",
                    name: "Laura Torres",
                    role: "Project Manager",
                    img: "https://i.pravatar.cc/150?img=5"
                }
            ].map((t, i) => (
                <div key={i} className="bg-gray-50 p-8 rounded-2xl relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white text-2xl font-serif">"</div>
                    <p className="text-gray-600 mb-6 italic pt-4">"{t.text}"</p>
                    <div className="flex items-center justify-center gap-3">
                        <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full" />
                        <div className="text-left">
                            <p className="text-sm font-bold text-primary">{t.name}</p>
                            <p className="text-xs text-gray-500">{t.role}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
}
