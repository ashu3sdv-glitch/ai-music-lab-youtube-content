# Editing patterns: educational AI / music / coding

Use these as selectable patterns, not a mandatory checklist. Direct effects on YouTube retention must be validated in the channel's retention graph; multimedia-learning research mainly measures comprehension and learning.

## Contents

- [1. Functional B-roll](#1-functional-b-roll)
- [2. On-screen signaling](#2-on-screen-signaling)
- [3. Semantic segmentation](#3-semantic-segmentation)
- [4. Friction-removing jump cuts](#4-friction-removing-jump-cuts)
- [5. Complexity-matched pacing](#5-complexity-matched-pacing)
- [6. Captions plus selective emphasis](#6-captions-plus-selective-emphasis)
- [7. Zoom as pointer](#7-zoom-as-pointer)
- [8. Functional pattern interrupt](#8-functional-pattern-interrupt)
- [Myths / dangerous advice](#myths--dangerous-advice)
- [Fast QA](#fast-qa)

## 1. Functional B-roll

- finding: Show the result, UI, code, graph or action exactly when it is discussed; B-roll carries meaning rather than decorates.
- retention_effect: Removes visual monotony without breaking the idea; YouTube-retention effect is plausible, not directly proven by the cited study.
- use_case: Prompt/result, MIDI movement, before/after audio, code execution.
- when_to_use: The evidence/action is more useful than the presenter’s face.
- when_not_to_use: Generic stock merely repeats a spoken noun.
- overuse_risk: Irrelevant visual changes add extraneous cognitive load.
- implementation_note: CapCut: overlay above A-roll, trim to the exact phrase, prefer a clean cut over an unnecessary transition.
- example: On “context failed after 8k tokens,” show and highlight the failure in the actual chat.
- source_type: research
- source_link: https://doi.org/10.1016/j.jarmac.2021.03.007
- confidence: high

## 2. On-screen signaling

- finding: Use a short label, color, box, cursor or arrow to identify the critical detail; do not duplicate the whole monologue.
- retention_effect: Lowers visual search effort, especially for novices; direct retention causality is not established.
- use_case: API parameter, code error, compressor knob, waveform difference.
- when_to_use: Dense interfaces, diagrams and comparisons.
- when_not_to_use: The target is already obvious.
- overuse_risk: If everything is highlighted, nothing is highlighted.
- implementation_note: CapCut Text/Shapes/Sticker or cropped duplicate layer; animate Position/Scale/Opacity with keyframes: https://www.capcut.com/tools/keyframe-animation
- example: Keep only `temperature = 0.2` and a label “more stable” beside the output.
- source_type: research
- source_link: https://doi.org/10.1016/j.edurev.2015.12.003
- confidence: high

## 3. Semantic segmentation

- finding: Divide dense instruction into explicit steps; mark boundaries with a short pause, heading or composition change.
- retention_effect: Restores orientation and processing time; do not impose a universal interval.
- use_case: Install → configure → test → debug; synth patch; agent pipeline.
- when_to_use: A step changes the viewer’s goal or interface.
- when_not_to_use: A short continuous proof would be fragmented.
- overuse_risk: Frequent chapter cards feel padded.
- implementation_note: Split on thought boundaries; add 0.3–0.8 s breathing room. Long-form may use chapters; Shorts usually need one clean visual turn.
- example: After generating vocals, pause and show “Step 2: remove artifacts,” then open the spectrum.
- source_type: research
- source_link: https://pmc.ncbi.nlm.nih.gov/articles/PMC9762622/
- confidence: high

## 4. Friction-removing jump cuts

- finding: Remove repeats, word-searching and waiting, while keeping micro-pauses before conclusions, jokes and critical actions.
- retention_effect: Shortens time to the next useful unit while preserving intelligibility and contrast.
- use_case: Talking head, build wait, preset search.
- when_to_use: The cut does not hide a causal step.
- when_not_to_use: Real-time demo, musical comparison or emotional admission.
- overuse_risk: Teleporting head, clipped consonants, no time to think.
- implementation_note: CapCut Split + ripple delete; audition every seam at 1× in headphones. Tool guide: https://www.capcut.com/resource/what-is-a-jump-cut
- example: Remove 18 seconds of installation, retain two seconds to read the final error.
- source_type: research
- source_link: https://doi.org/10.1145/2556325.2566239
- confidence: medium

## 5. Complexity-matched pacing

- finding: Accelerate delivery of value, not every voice and screen; let the viewer see the consequence of a complex action.
- retention_effect: Removes dead waiting while avoiding cognitive dropout.
- use_case: Speed a render; slow a stack trace, routing diagram or audio A/B.
- when_to_use: Pace follows complexity and prior knowledge.
- when_not_to_use: Do not time-compress critical audio or unreadable code.
- overuse_risk: Energy without comprehension lowers satisfaction.
- implementation_note: Cut or speed only process footage without speech; freeze/hold, zoom and label the critical state.
- example: Build at 8×, then 1× and hold the first traceback line for two seconds.
- source_type: research
- source_link: https://doi.org/10.1007/s10758-024-09745-2
- confidence: medium

## 6. Captions plus selective emphasis

- finding: Provide accurate captions for access/sound-off viewing; distinguish full captions from large emphasis text.
- retention_effect: Supports sound-off and technical terms; kinetic word-by-word text can compete with code/DAW visuals.
- use_case: Shorts, commands, model names, foreign terms, accessibility.
- when_to_use: Always provide a corrected caption track; burn in emphasis selectively.
- when_not_to_use: Do not cover relevant UI or animate every word during a dense demo.
- overuse_risk: ASR errors reduce trust; flashing text creates split attention.
- implementation_note: CapCut Captions → Auto Captions → language → Generate; manually fix terms/timing: https://www.capcut.com/help/how-to-recognise-subtitles
- example: Full captions below; beside code show only `async`, `await`, and “execution order.”
- source_type: research
- source_link: https://doi.org/10.1016/j.jarmac.2021.03.007
- confidence: medium

## 7. Zoom as pointer

- finding: Punch in for a change of conceptual scale or a small target, never by timer.
- retention_effect: Redirects attention; meaningless repetition becomes predictable noise.
- use_case: Small UI control, one code line, genuine reaction.
- when_to_use: One emphasis per thought.
- when_not_to_use: Whole diagram, musical performance, every talking-head sentence.
- overuse_risk: Motion sickness, manipulative feel, lost spatial context.
- implementation_note: Set Scale/Position keyframes 6–12 frames apart; return wide after reading: https://www.capcut.com/tools/keyframe-animation
- example: Punch into `429`, then pull wide to reveal retry logic.
- source_type: research
- source_link: https://doi.org/10.1016/j.edurev.2015.12.003
- confidence: medium

## 8. Functional pattern interrupt

- finding: Change the mode of thought—claim → proof, explanation → test, code → output, tension → brief release.
- retention_effect: Plausibly renews orientation; there is no official “change every N seconds” rule.
- use_case: Experiment, counterexample, audio A/B, error discovery.
- when_to_use: The question, evidence or emotional function changes.
- when_not_to_use: An effect adds no meaning and masks a weak script.
- overuse_risk: Glitches, swooshes and flashes fatigue viewers and devalue real turns.
- implementation_note: Mark story beats first; choose at most one dominant device per beat: cut, B-roll, text, pause, sound or meme.
- example: After sidechain theory, switch to dry/processed A/B and ask the viewer to identify it.
- source_type: hypothesis
- source_link: https://doi.org/10.3102/00346543211052329
- confidence: medium

## Myths / dangerous advice

- “Change the frame every 3/5/8 seconds.” No universal official threshold exists.
- “More cuts always improve retention.” Density can erase comprehension and trust.
- “Pauses are dead air.” Functional pauses support reading, listening and payoff.
- “Captions always help” / “captions always hurt.” Accessibility, language, complexity and competing visuals change the result.
- “Editing rescues a weak topic or broken promise.” It cannot replace topic fit, proof or satisfaction.

## Fast QA

Label every edit `clarify`, `prove`, `compress`, `orient`, `emotion` or `transition`; remove edits with no function. At the hardest frame, ask whether a viewer can simultaneously hear narration, read code/captions and follow animation. If not, remove one channel or segment the idea.
