/* eslint-disable */
const handler = async (event) => {
  try {
    const { "csp-report": cspReport } = JSON.parse(event.body);
    if (cspReport) {
      console.log(JSON.stringify(cspReport));
    }
  } catch (err) {
    // ...the sound of silence
  }
  return {
    statusCode: 200,
  };
};

export { handler };
