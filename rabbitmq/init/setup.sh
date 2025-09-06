#!/bin/bash
# RabbitMQ initialization script

# Wait for RabbitMQ to start
sleep 15

echo "🚀 Setting up RabbitMQ exchanges and queues..."

# Create exchanges
rabbitmqadmin declare exchange name=racky.sync.exchange type=topic durable=true
rabbitmqadmin declare exchange name=racky.products.exchange type=topic durable=true  
rabbitmqadmin declare exchange name=racky.ai.exchange type=topic durable=true
rabbitmqadmin declare exchange name=racky.updates.exchange type=topic durable=true
rabbitmqadmin declare exchange name=racky.dlx type=direct durable=true

# Create queues with dead letter configuration
echo "📦 Creating queues with dead letter handling..."

rabbitmqadmin declare queue name=sync.marketplace durable=true \
  arguments='{"x-dead-letter-exchange":"racky.dlx","x-dead-letter-routing-key":"failed","x-max-priority":10}'

rabbitmqadmin declare queue name=products.batch durable=true \
  arguments='{"x-dead-letter-exchange":"racky.dlx","x-dead-letter-routing-key":"failed","x-max-priority":10}'

rabbitmqadmin declare queue name=products.individual durable=true \
  arguments='{"x-dead-letter-exchange":"racky.dlx","x-dead-letter-routing-key":"failed","x-max-priority":10}'

rabbitmqadmin declare queue name=ai.scan durable=true \
  arguments='{"x-dead-letter-exchange":"racky.dlx","x-dead-letter-routing-key":"failed","x-max-priority":10}'

rabbitmqadmin declare queue name=ai.batch durable=true \
  arguments='{"x-dead-letter-exchange":"racky.dlx","x-dead-letter-routing-key":"failed","x-max-priority":10}'

rabbitmqadmin declare queue name=updates.batch durable=true \
  arguments='{"x-dead-letter-exchange":"racky.dlx","x-dead-letter-routing-key":"failed","x-max-priority":10}'

# Dead letter queue
rabbitmqadmin declare queue name=racky.failed durable=true

echo "🔗 Binding queues to exchanges..."

# Bind queues to exchanges
rabbitmqadmin declare binding source=racky.sync.exchange destination=sync.marketplace routing_key="sync.marketplace.#"
rabbitmqadmin declare binding source=racky.products.exchange destination=products.batch routing_key="products.batch.#"
rabbitmqadmin declare binding source=racky.products.exchange destination=products.individual routing_key="products.individual.#"
rabbitmqadmin declare binding source=racky.ai.exchange destination=ai.scan routing_key="ai.scan.#"
rabbitmqadmin declare binding source=racky.ai.exchange destination=ai.batch routing_key="ai.batch.#"
rabbitmqadmin declare binding source=racky.updates.exchange destination=updates.batch routing_key="updates.batch.#"

# Bind dead letter queue
rabbitmqadmin declare binding source=racky.dlx destination=racky.failed routing_key="failed"

echo "✅ RabbitMQ setup complete! Queues and exchanges configured."
echo "🌐 Management UI available at: http://localhost:15672 (racky/racky123)"