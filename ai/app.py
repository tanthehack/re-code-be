from quart import Quart, request, jsonify
from llama_cpp import Llama
import os

app = Quart(__name__)
# filename = "codellama-7b.Q5_K_M.gguf"
filename = "codellama-7b-instruct.Q5_K_M.gguf"
model_path = os.path.join(
    "C:\\Users\\Tanyalouise\\Documents\\re-code-be\\ai\\", filename
)

# Instantiating model from the local file
llm = Llama(
    model_path=model_path,
    n_gpu_layers=-1,
)

generation_kwargs = {
    "max_tokens": 1000,
    "stop": ["Explain", "Review:"],
    "echo": False,
    "top_k": 1,
    "temperature": 0.7,
    "frequency_penalty": 1
}


@app.route('/generate', methods=['POST'])
async def generate():
    try:
        data = await request.get_json()
        if not data or 'violation' not in data or 'code' not in data:
            return jsonify({'error': 'Invalid input, expected a JSON object with "violation" and "code" keys.'}), 400

        user = f"Violation: {data['violation']} \n code: \n {
            data['code']} \n Review:"
        prompt_temp = f"""
        [INST] Explain why the provide violation is a problem in the provided code snippet and how to fix the violation.
        Please wrap your code answer using ```javascript and ``` tags.
        {user}
        [/INST]
        """

        print(prompt_temp)

        # Generating the response
        response = llm(prompt_temp, **generation_kwargs)

        # Waiting for and processing the response
        # Adjust according to the actual response format
        review = response['choices'][0]['text'].strip()
        return jsonify({'review': review})

    except Exception as e:
        app.logger.error(f"Error processing request: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000)
