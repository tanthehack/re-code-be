from quart import Quart, request, jsonify
from llama_cpp import Llama
import os

app = Quart(__name__)
filename = "codellama-7b.Q5_K_M.gguf"
model_path = os.path.join(
    "C:\\Users\\Tanyalouise\\Documents\\re-code-be\\ai\\", filename
)

# Instantiating model from the local file
llm = Llama(
    model_path=model_path,
    n_gpu_layers=-1
)

generation_kwargs = {
    "max_tokens": 512,
    "stop": ["Review:"],
    "echo": False,
    "top_k": 1  # Greedy decoding
}


@app.route('/generate', methods=['POST'])
async def generate():
    try:
        data = await request.get_json()
        if not data or 'violation' not in data or 'code' not in data:
            return jsonify({'error': 'Invalid input, expected a JSON object with "violation" and "code" keys.'}), 400

        system = "You are a helpful programming assistant, here to provide explanations to code violations found in JavaScript code."
        user = f"Explain why the provide violation is a problem in the provided code snippet and how to fix the violations.\n Violation: {
            data['violation']} \n code: {data['code']} \n Review:"
        prompt = f"\n{system}\n\n{user}\n"

        print(prompt)

        # Generating the response
        response = llm(prompt, **generation_kwargs)

        # Waiting for and processing the response
        # Adjust according to the actual response format
        review = response['choices'][0]['text'].strip()
        return jsonify({'review': review})

    except Exception as e:
        app.logger.error(f"Error processing request: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=8000)
