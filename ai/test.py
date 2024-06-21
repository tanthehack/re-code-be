# Imports
# from huggingface_hub import hf_hub_download
from llama_cpp import Llama
import os

# Download the GGUF model
# model_name = "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF"
# model_file = "mixtral-8x7b-instruct-v0.1.Q4_K_M.gguf" # this is the specific model file we'll use in this example. It's a 4-bit quant, but other levels of quantization are available in the model repo if preferred
# model_path = hf_hub_download(model_name, filename=model_file)
filename = "codellama-7b.Q5_K_M.gguf"
model_path = os.path.join(
    "C:\\Users\\Tanyalouise\\Documents\\re-code-be\\ai\\", filename)

# Instantiate model from downloaded file
llm = Llama(
    model_path=model_path,
    # n_ctx=16000,  # Context length to use
    # n_threads=5,            # Number of CPU threads to use
    n_gpu_layers=-1        # Number of model layers to offload to GPU
)

# Generation kwargs
generation_kwargs = {
    "max_tokens": 1000,
    "stop": ["</s>"],
    "echo": False,  # Echo the prompt in the output
    "top_k": 1  # This is essentially greedy decoding, since the model will always return the highest-probability token. Set this value > 1 for sampling decoding
}

# Run inference
prompt = "You are a helpful skilled Javascript programming assistant. You output well structured JSON. You are a good code reviewer who follows best practices. You are reviewing a pull request that adds a new feature to a codebase. You are reviewing the code to ensure it is well-structured and easy to maintain. You receive the following code: ```js\nconsole.log(\"hi)```. What feedback do you provide? Output <s/> at the end of your response. "
res = llm(prompt, **generation_kwargs)  # Res is a dictionary

# Unpack and the generated text from the LLM response dictionary and print it
# print(res)

# res = llm.create_chat_completion(
#     messages=[
#         {
#             "role": "system",
#             "content": "You are a helpful programming assistant.",
#         },
#         {"role": "user", "content": "write a javascript function to add two numbers."},
#     ],
#     response_format={
#         "type": "json_object",
#     },
#     temperature=0.7,
# )


print(res)
# res is short for result
