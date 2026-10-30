# World Models, from first principles to pregnancy

An interactive course on world models in six modules, from everyday intuition (high-school level) to the 2026 state of the art and applications in pregnancy. Each module has narrated, scrubbable animated explainers, live simulations that run in the browser, a quiz and a sourced reading list.

Live site: https://ramthiru83.github.io/world-models-course/

## Modules

1. What is a world model?
2. States, actions and imagining ahead
3. Learning a model from data
4. Latent worlds and dreaming
5. State of the art, 2026 (a snapshot dated 29 October 2026)
6. World models for pregnancy

Diagram convention: solid ink is reality or measurement, dashed violet is what a model imagines or predicts, red marks error.

## Run locally

Static site, no build step. Serve the folder with any static server that supports HTTP Range requests (for example `npx serve`), then open `index.html`. Opening the file directly works for everything except narration, which needs `http(s)`.

## Notes

- All pregnancy examples use synthetic data generated in the browser. No participant or patient data are included.
- Narration audio was synthesised with Google Cloud Text-to-Speech (Chirp 3 HD, en-GB) from scripts written for the explainers.
- Progress (quiz scores, reading position, theme) is stored only in the learner's own browser.
