# danilovargasdasilva.github.io

Site pessoal do Danilo Vargas da Silva, publicado com GitHub Pages.

## Estrutura

- `index.html`: a página inteira (HTML e CSS no mesmo arquivo)
- `assets/profile.jpg`: foto do perfil
- `.nojekyll`: diz ao GitHub Pages para servir os arquivos como estão, sem Jekyll

## Como atualizar

1. Edite o `index.html`.
2. `git add . && git commit -m "Atualiza site" && git push`
3. O site atualiza sozinho em 1 ou 2 minutos.

## Ao publicar um projeto novo

Na seção Projects, troque `planned` por um link para o repositório, por exemplo:

```html
<li><b>P0</b><span><a href="https://github.com/danilovargasdasilva/micrograd-notes">micrograd-notes</a>: an autograd engine written from scratch</span><em>shipped</em></li>
```

Depois adicione uma linha na seção News com a data e o que saiu.

## CV

A seção CV fica na própria página, e o `cv.pdf` é gerado a partir dela, sem o seu telefone.
Para atualizar o PDF depois de editar a seção CV:

1. Abra o `index.html` no Chrome.
2. Ctrl+P → Destino "Salvar como PDF" → Papel A4 → Margens "Padrão".
3. Salve por cima do `cv.pdf`. A versão impressa da página mostra só o CV.

## Animações

Ficam em `assets/motion.js`:

- pontos no topo que reagem ao mouse;
- a ponte rolante com o avatar levando os blocos P0 a P8 de "planned" para "shipped";
- robôs andando sobre a cota da trajetória (clique num deles para ele pular e falar);
- o texto que digita os tipos de projeto (lista `WORDS`);
- os números que contam até o valor final;
- a barra de progresso de leitura.

As frases dos robôs estão na lista `SAY`. Quem ativou "reduzir movimento" no sistema vê tudo parado.

## Ícones e fontes

Os ícones (Font Awesome Free 6.5.2) e as fontes (Archivo e Literata) estão em `assets/`, então o site não depende de CDN.
Para adicionar um link na barra lateral, copie uma linha da lista `side-links` e troque o ícone.
Há linhas comentadas prontas para ORCID, Google Scholar e Hugging Face.
