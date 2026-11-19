export const metadata = { title: "Política de privacidade — Indikaí" };
export default function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-6 leading-relaxed">
      <h1 className="text-2xl font-bold">Política de privacidade (LGPD)</h1>
      <p className="text-sm text-stone-500">Modelo inicial — revise com um advogado antes de lançar em escala.</p>
      <h2 className="text-lg font-semibold">Dados que coletamos</h2>
      <ul className="list-disc pl-6">
        <li><b>Moradores:</b> e-mail (ou conta Google), nome, bloco/torre e unidade.</li>
        <li><b>Prestadores indicados:</b> nome, categoria, descrição, foto (opcional) e número de WhatsApp, informados por um morador.</li>
        <li><b>Avaliações e denúncias</b> feitas na plataforma.</li>
      </ul>
      <h2 className="text-lg font-semibold">Para que usamos</h2>
      <p>Para autenticar você, mostrar indicações aos vizinhos do mesmo condomínio, evitar avaliações falsas e moderar conteúdo. Não vendemos seus dados.</p>
      <h2 className="text-lg font-semibold">O que os vizinhos veem</h2>
      <p>Em avaliações aparecem apenas seu primeiro nome, a inicial do sobrenome e o bloco (ex.: “Maria S. · Bloco B”). Seu e-mail e sua unidade não são exibidos. Os dados de prestadores (nome, WhatsApp, descrição) ficam visíveis apenas a moradores cadastrados no mesmo condomínio.</p>
      <h2 className="text-lg font-semibold">Seus direitos</h2>
      <p>Você pode solicitar acesso, correção ou exclusão dos seus dados, e prestadores podem pedir a remoção do seu perfil, entrando em contato com a administração do Indikaí.</p>
      <h2 className="text-lg font-semibold">Terceiros</h2>
      <p>Usamos Supabase (autenticação e banco de dados) e Vercel (hospedagem). O contato via WhatsApp é feito por você, fora da plataforma.</p>
      <p><a href="/termos" className="underline">Termos de uso</a></p>
    </main>
  );
}
