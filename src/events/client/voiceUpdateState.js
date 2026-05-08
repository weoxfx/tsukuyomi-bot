import Event from "../../structures/Event.js";

class VoiceStateUpdate extends Event {
  constructor(client, file) {
    super(client, file, {
      name: "voiceStateUpdate",
    });
  }
  async run(oldState, newState) {
    // Music system removed
  }
}

export default VoiceStateUpdate;
